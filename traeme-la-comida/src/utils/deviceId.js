export const getDeviceId = () => {
    let deviceId = localStorage.getItem('traeme_device_id');
    if (!deviceId) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            deviceId = crypto.randomUUID();
        } else {
            // Fallback for non-secure contexts
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
        localStorage.setItem('traeme_device_id', deviceId);
    }
    return deviceId;
};
