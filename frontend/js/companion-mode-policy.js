(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CompanionModePolicy = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function getModePolicy(mode) {
        const normalized = ['quiet', 'occasional', 'strict'].includes(mode) ? mode : 'quiet';
        return {
            mode: normalized,
            generateOpening: true,
            generateCompletion: true,
            autoPlayVoice: normalized !== 'quiet',
            cameraRequired: normalized === 'strict',
            realtimeVision: normalized === 'strict'
        };
    }
    return { getModePolicy };
});
