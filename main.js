import * as THREE from 'three';

// --- DOM ELEMENTS ---
const scoreElement = document.getElementById('score');
const instructionsElement = document.getElementById('instructions');
const resultsElement = document.getElementById('results');
const finalScoreElement = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

// --- 3D SCENE SETUP ---
let scene, camera, renderer;
const stack = [];
const overhangs = [];

// --- GAME STATE ---
let gameState = 'loading'; // loading, playing, gameover
let moveSpeed = 0.1;

function init() {
    gameState = 'playing';
    
    // Clear previous game objects
    while (stack.length > 0) scene.remove(stack.pop());
    while (overhangs.length > 0) scene.remove(overhangs.pop());

    // UI Reset
    scoreElement.innerText = 0;
    resultsElement.classList.add('hidden');
    instructionsElement.classList.remove('hidden');

    // Foundation Block
    addLayer(0, 0, 10, 10);

    // First moving block
    addLayer(0, 2, 10, 10, 'x');
    
    moveSpeed = 0.1;

    // --- Scene & Camera ---
    if (!scene) {
        scene = new THREE.Scene();
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 0);
        scene.add(directionalLight);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        const width = 20;
        const height = width / aspect;

        camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 100);
        camera.position.set(4, 4, 4);
        camera.lookAt(0, 0, 0);
    }
}

function startGame() {
    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        renderer.setAnimationLoop(animation);
        
        window.addEventListener('resize', onWindowResize);
        restartButton.addEventListener('click', () => {
             init();
             window.addEventListener('pointerdown', handleUserAction);
        });
    }
    init();
    window.addEventListener('pointerdown', handleUserAction);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const width = 20;
    const height = width / aspect;

    camera.left = width / -2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = height / -2;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function generateBox(x, y, z, width, depth) {
    const geometry = new THREE.BoxGeometry(width, 2, depth);
    const hue = (stack.length * 10) % 360;
    const material = new THREE.MeshLambertMaterial({ color: `hsl(${hue}, 80%, 60%)` });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    return mesh;
}

function addLayer(x, y, width, depth, direction) {
    const newBlock = generateBox(x, y, 0, width, depth);
    if (direction) {
        newBlock.direction = direction;
        newBlock.reverse = false;
    }
    stack.push(newBlock);
    scene.add(newBlock);
}

function addOverhang(x, z, width, depth) {
    const y = (stack.length - 2) * 2;
    const overhang = generateBox(x, y, z, width, depth);
    overhangs.push(overhang);
    scene.add(overhang);
}

function handleUserAction() {
    if (gameState !== 'playing') return;

    const topLayer = stack[stack.length - 1];
    const prevLayer = stack[stack.length - 2];
    const direction = topLayer.direction;

    const delta = topLayer.position[direction] - prevLayer.position[direction];
    const overhang = Math.abs(delta);
    
    const size = direction === 'x' ? topLayer.geometry.parameters.width : topLayer.geometry.parameters.depth;
    const overlap = size - overhang;

    if (overlap > 0) {
        // Cut the block
        const newWidth = direction === 'x' ? overlap : topLayer.geometry.parameters.width;
        const newDepth = direction === 'z' ? overlap : topLayer.geometry.parameters.depth;

        // Update top layer
        topLayer.scale[direction] = overlap / size;
        topLayer.position[direction] -= delta / 2;
        topLayer.direction = undefined; // Stop moving

        // Create overhang piece
        const overhangSize = size - overlap;
        const overhangShift = (overlap / 2) + (overhangSize / 2);
        const overhangPos = topLayer.position.clone();
        overhangPos[direction] += delta > 0 ? overhangShift : -overhangShift;

        addOverhang(
            overhangPos.x,
            overhangPos.z,
            direction === 'x' ? overhangSize : newWidth,
            direction === 'z' ? overhangSize : newDepth
        );
        
        // Next Block
        const nextY = stack.length * 2;
        const nextDirection = direction === 'x' ? 'z' : 'x';
        addLayer(topLayer.position.x, nextY, newWidth, newDepth, nextDirection);

        // Update score
        scoreElement.innerText = stack.length - 1;
        instructionsElement.classList.add('hidden');
        moveSpeed += 0.005;

    } else {
        gameOver();
    }
}

function gameOver() {
    gameState = 'gameover';
    
    // Remove the missed block
    const missedBlock = stack.pop();
    scene.remove(missedBlock);
    overhangs.push(missedBlock); // Make it fall
    
    // Show results screen
    finalScoreElement.textContent = stack.length - 1;
    resultsElement.classList.remove('hidden');

    window.removeEventListener('pointerdown', handleUserAction);
}

function animation() {
    if (gameState === 'playing') {
        const topLayer = stack[stack.length - 1];
        const moveBoundary = 12;

        topLayer.position[topLayer.direction] += topLayer.reverse ? -moveSpeed : moveSpeed;
        if (Math.abs(topLayer.position[topLayer.direction]) >= moveBoundary) {
            topLayer.reverse = !topLayer.reverse;
        }

        // Move camera up with stack
        const targetCameraY = stack.length * 2 + 4;
        camera.position.y += (targetCameraY - camera.position.y) * 0.05;
        camera.lookAt(0, (stack.length-1) * 2, 0); // Focus on the top block's height
    }

    // Animate overhangs falling
    overhangs.forEach(overhang => {
        overhang.position.y -= 0.2;
        overhang.rotation.x += 0.02;
        overhang.rotation.z += 0.02;
    });

    // Clean up overhangs that are off screen
    for (let i = overhangs.length - 1; i >= 0; i--) {
        if (overhangs[i].position.y < -20) {
            scene.remove(overhangs[i]);
            overhangs.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

startGame();

