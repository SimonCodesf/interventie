// Interventie — AR krant (slimme boot)
//
// Camera-eerst: de camerafeed verschijnt meteen na de tap (of automatisch
// op Android/desktop). De three.js + MindAR-bibliotheken laden daarna op de
// achtergrond en nemen de tracking over zodra ze klaar zijn.
//
// Stack: three.js (655KB) + slanke MindAR-controller (~2MB, enkel geladen
// bij eerste gebruik en daarna immutable gecached).

const AR_TUNING = {
    filterMinCF: 0.0015,
    filterBeta: 0.008,
    warmupTolerance: 0,
    missTolerance: 2,
};

let mode = 'current';
let arStarted = false;
let busy = false;

let THREE = null;
let Controller = null;
let container, renderer, scene3, camera3, video, stream;
let controller = null;
let anchors = [];
let postMatrixs = [];
let animMeshes = [];       // { mesh, z0, dist, dur }
let renderStarted = false;

let currentEssay = null;
let currentMindBuffer = null;
let previousBundle = null;
let previousBuffer = null;

const containerEl = function () { return document.getElementById('ar-scene'); };
const toggleBtn = function () { return document.getElementById('toggle-prev'); };

function webglSupported() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function fatalError(msg) {
    const overlay = document.getElementById('start-overlay');
    const btn = document.getElementById('start-btn');
    btn.textContent = msg;
    btn.disabled = true;
    overlay.style.display = 'flex';
}

// ---- Camera eerst ----

async function bootCamera() {
    if (arStarted) return;
    arStarted = true;

    if (!webglSupported()) { fatalError('NIET BESCHIKBAAR'); return; }

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' },
        });
    } catch (err) {
        console.error(err);
        fatalError('CAMERA GEBLOKKEERD');
        return;
    }

    // Camerafeed direct tonen (nog vóór de bibliotheken geladen zijn)
    video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.srcObject = stream;
    containerEl().appendChild(video);
    video.play().catch(function () {});

    document.getElementById('start-overlay').style.display = 'none';

    // Bibliotheken + data op de achtergrond laden terwijl de camera al draait
    try {
        const [threeMod, mindMod, essayRes, currentRes] = await Promise.all([
            import('./vendor/three.module.min.js'),
            import('./vendor/mindar-runtime.bundle.js'),
            fetch('api.php/essays/current'),
            fetch('api.php/essays/previous'),
        ]);

        THREE = threeMod;
        Controller = mindMod.Controller;

        if (essayRes.ok) currentEssay = await essayRes.json();
        if (currentRes.ok) previousBundle = await currentRes.json();

        if (!currentEssay || !currentEssay.mind) { fatalError('NIET BESCHIKBAAR'); return; }

        const mindRes = await fetch(currentEssay.mind);
        currentMindBuffer = await mindRes.arrayBuffer();

        if (previousBundle && previousBundle.mind && previousBundle.essays && previousBundle.essays.length) {
            const prevRes = await fetch(previousBundle.mind);
            previousBuffer = await prevRes.arrayBuffer();
        }

        initRenderer();
        await startSession({
            mindBuffer: currentMindBuffer,
            targets: [{ index: 0, layers: currentEssay.layers }],
        });
    } catch (err) {
        console.error(err);
        fatalError('NIET BESCHIKBAAR');
    }
}

// ---- three.js setup (één keer) ----

function initRenderer() {
    container = containerEl();
    scene3 = new THREE.Scene();
    camera3 = new THREE.PerspectiveCamera();
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    container.appendChild(canvas);

    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(function () {
        if (!renderStarted) return;
        const t = clock.getElapsedTime();
        for (const a of animMeshes) {
            const k = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / a.dur - Math.PI / 2);
            a.mesh.position.z = a.z0 + a.dist * k;
        }
        renderer.render(scene3, camera3);
    });
}

// ---- Sessie (per chunk) ----

async function startSession(opts) {
    if (busy) return;
    busy = true;

    // Oude sessie afbreken (camera blijft gewoon draaien)
    stopSession();

    const t = Date.now();
    controller = new Controller({
        inputWidth: video.videoWidth || 1280,
        inputHeight: video.videoHeight || 720,
        filterMinCF: AR_TUNING.filterMinCF,
        filterBeta: AR_TUNING.filterBeta,
        warmupTolerance: AR_TUNING.warmupTolerance,
        missTolerance: AR_TUNING.missTolerance,
        maxTrack: 1,
        onUpdate: onControllerUpdate,
    });

    resize();

    const { dimensions } = controller.addImageTargetsFromBuffer(opts.mindBuffer);

    postMatrixs = [];
    for (let i = 0; i < dimensions.length; i++) {
        const [markerWidth, markerHeight] = dimensions[i];
        const m = new THREE.Matrix4();
        m.compose(
            new THREE.Vector3(markerWidth / 2, markerWidth / 2 + (markerHeight - markerWidth) / 2, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(markerWidth, markerWidth, markerWidth)
        );
        postMatrixs.push(m);
    }

    anchors = opts.targets.map(function (t) { return buildAnchor(t); });

    await controller.dummyRun(video);
    controller.processVideo(video);
    renderStarted = true;
    console.log('AR sessie klaar in ' + Math.round(Date.now() - t) + ' ms');
    busy = false;
}

function stopSession() {
    renderStarted = false;
    if (controller) {
        try {
            controller.stopProcessVideo();
            controller.dispose();
        } catch (e) { /* sessie was al afgebroken */ }
        controller = null;
    }
    if (scene3) {
        for (const a of anchors) scene3.remove(a.group);
    }
    anchors = [];
    animMeshes = [];
}

function buildAnchor(spec) {
    const group = new THREE.Group();
    group.visible = false;
    group.matrixAutoUpdate = false;
    scene3.add(group);

    const anchor = {
        group: group,
        targetIndex: spec.index,
        layers: spec.layers || [],
        texturesLoaded: false,
        visible: false,
    };

    anchor.onTargetFound = function () {
        // Media pas laden bij eerste detectie (snel + klaar voor zware assets)
        if (!anchor.texturesLoaded) {
            anchor.texturesLoaded = true;
            const loader = new THREE.TextureLoader();
            anchor.layers.forEach(function (layer) {
                const mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(layer.w, layer.h),
                    new THREE.MeshBasicMaterial({ map: loader.load(layer.file), transparent: true })
                );
                mesh.position.set(0, 0, layer.z);
                group.add(mesh);

                if (layer.anim_dur > 0) {
                    animMeshes.push({ mesh: mesh, z0: layer.z, dist: layer.anim_dist, dur: layer.anim_dur });
                }
            });
        }
    };

    return anchor;
}

function onControllerUpdate(data) {
    if (data.type !== 'updateMatrix') return;
    const { targetIndex, worldMatrix } = data;

    for (const a of anchors) {
        if (a.targetIndex !== targetIndex) continue;

        a.group.visible = worldMatrix !== null;
        if (worldMatrix !== null) {
            const m = new THREE.Matrix4();
            m.elements = worldMatrix;
            m.multiply(postMatrixs[targetIndex]);
            a.group.matrix = m;
        } else {
            a.group.matrix.set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1);
        }

        if (a.visible && worldMatrix === null) {
            a.visible = false;
        } else if (!a.visible && worldMatrix !== null) {
            a.visible = true;
            if (a.onTargetFound) a.onTargetFound();
        }
    }
}

// ---- Resize (projectie + video-cover, zoals MindAR's eigen three-adapter) ----

function resize() {
    if (!video || !renderer) return;

    container = containerEl();
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    if (controller) {
        const videoRatio = video.videoWidth / video.videoHeight;
        const containerRatio = cw / ch;
        let vw, vh;
        if (videoRatio > containerRatio) {
            vh = ch;
            vw = vh * videoRatio;
        } else {
            vw = cw;
            vh = vw / videoRatio;
        }

        const proj = controller.getProjectionMatrix();
        const inputRatio = controller.inputWidth / controller.inputHeight;
        const inputAdjust = inputRatio > containerRatio
            ? video.videoWidth / controller.inputWidth
            : video.videoHeight / controller.inputHeight;

        let videoDisplayHeight;
        if (inputRatio > containerRatio) {
            videoDisplayHeight = ch * inputAdjust;
        } else {
            videoDisplayHeight = (cw / controller.inputWidth * controller.inputHeight) * inputAdjust;
        }
        const fovAdjust = ch / videoDisplayHeight;

        const fov = 2 * Math.atan(1 / proj[5] * fovAdjust) * 180 / Math.PI;
        const near = proj[14] / (proj[10] - 1.0);
        const far = proj[14] / (proj[10] + 1.0);

        camera3.fov = fov;
        camera3.near = near;
        camera3.far = far;
        camera3.aspect = cw / ch;
        camera3.updateProjectionMatrix();

        video.style.top = (-(vh - ch) / 2) + 'px';
        video.style.left = (-(vw - cw) / 2) + 'px';
        video.style.width = vw + 'px';
        video.style.height = vh + 'px';
    }

    renderer.setSize(cw, ch);
}

// ---- Knop: wisselen tussen huidige en vorige essays ----

toggleBtn().addEventListener('click', async function () {
    if (busy) return;

    if (mode === 'previous') {
        if (!currentMindBuffer || !currentEssay) return;
        mode = 'current';
        this.textContent = 'SCAN VORIGE ESSAYS';
        await startSession({ mindBuffer: currentMindBuffer, targets: [{ index: 0, layers: currentEssay.layers }] });
        return;
    }

    if (!previousBuffer || !previousBundle) return;

    mode = 'previous';
    this.textContent = 'SCAN HUIDIG ESSAY';
    await startSession({
        mindBuffer: previousBuffer,
        targets: previousBundle.essays.map(function (e) {
            return { index: e.targetIndex, layers: e.layers };
        }),
    });
});

// ---- Boot ----

if (!isIOS()) {
    bootCamera();
} else {
    document.getElementById('start-btn').addEventListener('click', bootCamera);
}
