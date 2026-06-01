"use strict";
(() => {
    let qrSendStream = null;
    function startCamera(video, addrIn, btn) {
        var _a;
        if (!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia)) {
            alert("Camera not available in this browser / context.");
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
            qrSendStream = stream;
            video.srcObject = stream;
            video.style.display = "block";
            video.play();
            btn.classList.add("active");
            scanQR(video, addrIn);
        })
            .catch(() => alert("Camera permission denied."));
    }
    function stopCamera() {
        if (qrSendStream) {
            qrSendStream.getTracks().forEach(t => t.stop());
            qrSendStream = null;
        }
        const video = document.getElementById("send-video");
        if (video) {
            video.style.display = "none";
            video.srcObject = null;
        }
        const btn = document.getElementById("send-qr-btn");
        if (btn)
            btn.classList.remove("active");
    }
    function isCameraRunning() {
        return qrSendStream !== null;
    }
    function scanQR(video, addrIn) {
        const hint = document.getElementById("send-scan-hint");
        if (hint) {
            hint.textContent = "Point the camera at a QR code.";
            hint.style.display = "block";
        }
        if (typeof jsQR !== "function") {
            if (hint)
                hint.textContent = "QR scanner library is not loaded.";
            return;
        }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx)
            return;
        const tick = () => {
            if (!qrSendStream)
                return;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const imageData = ctx.getImageData(0, 0, w, h);
                const result = jsQR(imageData.data, w, h, {
                    inversionAttempts: "attemptBoth"
                });
                if (result) {
                    addrIn.value = result.data;
                    if (hint)
                        hint.style.display = "none";
                    stopCamera();
                    return;
                }
            }
            requestAnimationFrame(tick);
        };
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            tick();
        }
        else {
            video.addEventListener("loadeddata", tick, { once: true });
        }
    }
    const globals = window;
    globals.startCamera = startCamera;
    globals.stopCamera = stopCamera;
    globals.isCameraRunning = isCameraRunning;
})();
//# sourceMappingURL=qr_scan.js.map