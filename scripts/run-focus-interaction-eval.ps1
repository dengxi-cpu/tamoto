param([string]$Endpoint = 'https://tamoto-main.vercel.app')
$ErrorActionPreference = 'Stop'
$assets = @{
  PHONE = 'frontend/assets/mock/focus-phone.jpg'
  DESK = 'frontend/assets/mock/focus-study-desk.jpg'
  REST = 'frontend/assets/mock/focus-study-rest.jpg'
  WRITING = 'frontend/assets/mock/focus-study-writing.jpg'
}

function Get-ImageData([string]$Kind) {
  $bytes = [IO.File]::ReadAllBytes((Resolve-Path $assets[$Kind]))
  return 'data:image/jpeg;base64,' + [Convert]::ToBase64String($bytes)
}

function New-Context {
  return @{ workingMemory = @(); storyMemory = ''; conversationHistory = @(); lastSpokenElapsed = $null }
}

function Invoke-Frame([string]$Kind, [int]$Index, [hashtable]$Context, [long]$Epoch) {
  $elapsed = $Index * 20
  $policy = @{}
  if ($null -ne $Context.lastSpokenElapsed) {
    $policy.lastAnySpokenAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - (($elapsed - $Context.lastSpokenElapsed) * 1000)
  }
  $request = @{
    image = Get-ImageData $Kind
    task = '保持专注学习'
    persona = '毒舌但关心用户的陪伴者，说话自然简短'
    roleContext = @{ name='TA'; userTitle='大小姐'; relationship='监督型陪伴者'; persona='毒舌但关心用户的陪伴者，说话自然简短'; speechLanguage='zh' }
    epoch = $Epoch
    turnId = $Index + 1
    sessionStartedAt = [DateTime]::UtcNow.AddSeconds(-$elapsed).ToString('o')
    elapsedSeconds = $elapsed
    workingMemory = $Context.workingMemory
    recentObservations = $Context.workingMemory
    storyMemory = $Context.storyMemory
    relationshipMemory = ''
    conversationHistory = $Context.conversationHistory
    policyState = $policy
  } | ConvertTo-Json -Depth 20 -Compress
  $result = (Invoke-RestMethod -Uri "$Endpoint/api/companion-observe" -Method Post -ContentType 'application/json' -Body $request -TimeoutSec 90).data
  $reaction = [string]$result.reaction
  $event = @{
    id = "frame-$($Index + 1)"; type = 'vision'; elapsedSeconds = $elapsed
    state = $result.observation.state; observation = $result.observation.observation
    changes = @($result.observation.changes); confidence = $result.observation.confidence; reaction = $reaction
    actorAction = if ($reaction) { @{ said=$reaction; intent=$result.memory.responseIntent; intendedUserAction=$result.memory.intendedUserAction; outputLanguage='zh'; actionType=$result.memory.actorActionType; expectsUserResponse=($result.memory.expectsUserResponse -eq $true) } } else { $null }
  }
  $Context.workingMemory = @($Context.workingMemory) + @($event)
  $Context.storyMemory = $result.memory.storyMemory
  if ($reaction) {
    $Context.lastSpokenElapsed = $elapsed
    $Context.conversationHistory = @($Context.conversationHistory) + @(@{ role='assistant'; content=$reaction })
  }
  return [ordered]@{
    input=$Kind; state=$result.observation.state; outcome=$result.memory.interactionOutcome.type
    attitude=$result.memory.characterState.attitude; shouldSpeak=$result.decision.shouldSpeak
    reaction=$reaction; intent=$result.memory.responseIntent
  }
}

function Invoke-Scenario([string]$Name, [string[]]$Sequence, [scriptblock]$Setup = $null) {
  $context = New-Context
  if ($Setup) { & $Setup $context }
  $frames = @()
  $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + (Get-Random -Maximum 9999)
  try {
    for ($index = 0; $index -lt $Sequence.Count; $index++) { $frames += Invoke-Frame $Sequence[$index] $index $context $epoch }
    return [ordered]@{ name=$Name; frames=$frames }
  } catch {
    return [ordered]@{ name=$Name; error=$_.Exception.Message }
  }
}

$results = @()
$results += Invoke-Scenario 'stable study' @('WRITING','WRITING','WRITING')
$results += Invoke-Scenario 'phone then followed request' @('PHONE','WRITING','WRITING')
$results += Invoke-Scenario 'ignored phone request' @('PHONE','PHONE','PHONE','PHONE')
$results += Invoke-Scenario 'phone to writing without prior AI request' @('WRITING') { param($context); $context.workingMemory = @(@{ id='seed-phone'; type='vision'; elapsedSeconds=0; state='PHONE'; observation='此前看见用户手持手机，但 AI 尚未开口'; confidence=.9; reaction=''; actorAction=$null }) }
$results += Invoke-Scenario 'phone, recover, relapse' @('PHONE','WRITING','PHONE')
$results += Invoke-Scenario 'visible study evidence without phone interaction' @('DESK','WRITING','WRITING')
$results | ConvertTo-Json -Depth 12
