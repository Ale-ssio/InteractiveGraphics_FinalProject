import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import * as dat from 'dat.gui';
import CannonDebugger from 'cannon-es-debugger'
import WebGL from 'three/examples/jsm/capabilities/WebGL.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// VARIABLES DECLARATION
// Three.js main variables
var scene, camera, renderer;
// Loader for 3D models, Controls, Gui Controls
var loader, controls, datGUI, keysPressed = {};
// Helpers
var axes, grid, dLightHelper, cannonDebugger;
// Lights
var ambientLight, directionalLight;
var ambientLightFolder, directionalLightFolder;
// Physic World
var world, timeStep;
// Floor
var floorGeo, floorMat, floorMesh;
// Floor Body
var floorPhysMat, floorBody;
// Bullets
var bulletGeo, bulletMat, bulletMesh, bullets = [];
// Bullets Body
var bulletPhysMat, bulletBody;
// Cylinder
var cylinderGeo, cylinderMat, cylinderMesh, cylinderPhysMat, cylinderBody;

// Call the main function
init();

function init() {

    //===================================================================
    // INITIALIZING THREE.JS

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
        // Setting the position
    camera.position.set(0, 2, 30);
        // Looking at the origin of the scene
    camera.lookAt(0, 2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({antialias: false});
        // Fill the entire window, set color to black
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
        // Adding shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    //===================================================================
    // SETTING CONTROLS
    
    controls = new OrbitControls(camera, renderer.domElement);
        // Parameters
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.target = new THREE.Vector3(0, 2, 0);
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.RIGHT,
        MIDDLE: THREE.MOUSE.MIDDLE,
        RIGHT: THREE.MOUSE.LEFT
    }
    controls.update();

    //===================================================================
    // ADDING HELPERS

    // Visualize cartesian axes
    axes = new THREE.AxesHelper(2);
    scene.add(axes);

    // Visualize a grid on the floor
    grid = new THREE.GridHelper(100, 10);
    scene.add(grid);

    //===================================================================
    // SETTING THE LIGHTS

    // Ambient Light
    ambientLight = new THREE.AmbientLight(0x555555)
    scene.add(ambientLight);

    // Directional Light
    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-50, 100, 20);
    directionalLight.castShadow = true;
    // Shaper shadows with higher resolution
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    // Area of effect: directional light is infinite, specify the area to cover
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Helper to see light direction
    dLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
    scene.add(dLightHelper);

    //===================================================================
    // ADDING CONTROLS FOR THE LIGHTS

    datGUI = new dat.GUI();

    // Range of possible values on the GUI
    ambientLightFolder = datGUI.addFolder('Ambient Light');
    ambientLightFolder.add(ambientLight, 'intensity', 0.01, 10);
    ambientLightFolder.add(ambientLight.color, 'r', 0, 1);
    ambientLightFolder.add(ambientLight.color, 'g', 0, 1);
    ambientLightFolder.add(ambientLight.color, 'b', 0, 1);
    ambientLightFolder.open();

    directionalLightFolder = datGUI.addFolder('Directional Light');
    directionalLightFolder.add(directionalLight.position, 'x', -100, 100);
    directionalLightFolder.add(directionalLight.position, 'y', 0, 200);
    directionalLightFolder.add(directionalLight.position, 'z', -100, 100);
    directionalLightFolder.add(directionalLight, 'intensity', 0.01, 10);
    directionalLightFolder.open();

    //===================================================================
    // PLANE IN THREE.JS TO BUILD THE FLOOR

    floorGeo = new THREE.PlaneGeometry(1000, 1000);
    floorMat = new THREE.MeshPhongMaterial({
        color: 0x555555,
        side: THREE.DoubleSide,
        //wireframe: true
    });
        // Building the floor
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
        // Shadows: the floor doesn't cast shadows, only receives
    floorMesh.castShadow = false;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    //===================================================================
    // INITIALIZING THE PHYSIC WORLD

    world = new CANNON.World({
        // Gravity Force
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    timeStep = 1 / 60;

    //===================================================================
    // CANNON-ES-DEBUGGER

    cannonDebugger = new CannonDebugger(scene, world);

    //===================================================================
    // BUILDING A BODY FOR THE FLOOR

        // Collisions depend on involved materials
    floorPhysMat = new CANNON.Material();

    floorBody = new CANNON.Body({
        // Static, it has mass: 0
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(1000, 1000, 0.01)),
        material: floorPhysMat
    });
        // I need to rotate the plan to make it a floor
    floorBody.quaternion.setFromEuler(-.5*Math.PI, 0, 0);
    world.addBody(floorBody);

    // CYLINDER IN THREE JS
    cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
    cylinderMat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        //wireframe: true
    });
    cylinderMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
    cylinderMesh.castShadow = true;
    cylinderMesh.receiveShadow = true;
    scene.add(cylinderMesh);
    // BODY FOR THE CYLINDER (PHYSIC CYLINDER)
    cylinderPhysMat = new CANNON.Material();

    cylinderBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Cylinder(0.5, 0.5, 2, 32),
        position: new CANNON.Vec3(-2, 10, 0),
        material: cylinderPhysMat
    });
    world.addBody(cylinderBody);

    // Air resistance
    cylinderBody.linearDamping = 0.5; // [0, 1]
    
    //===================================================================
    // RENDERING THE SCENE

    // Displaying the scene adding a <canvas> element to the HTML
    document.body.appendChild(renderer.domElement);

    if (WebGL.isWebGLAvailable()) {
        animate();
    } else {
        const warning = WebGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
    }

}

//===================================================================
// SHOOT LISTENER
window.addEventListener('keyup', function(event) {
    if (event.code === 'Space') shootBullet();
});

//===================================================================
// ANIMATE FUNCTION

function animate() {
    // Loop and keep things up to date
    requestAnimationFrame(animate);
    // Time between updates
    world.step(timeStep);
    // Update position and quaternion of objects w.r.t their body
    updatePhysics();
    // Update controls
    controls.update();
    // Update cannon-es-debugger
    cannonDebugger.update();
    // Actually render the scene
    renderer.render(scene, camera);
}

//===================================================================
// UPDATE PHYSICS FUNCTION

function updatePhysics() {
    // Floor
    floorMesh.position.copy(floorBody.position);
    floorMesh.quaternion.copy(floorBody.quaternion);
    // Bullets
    bullets.forEach((bullet) => {
        bullet.mesh.position.copy(bullet.body.position);
        bullet.mesh.quaternion.copy(bullet.body.quaternion);
    });

    cylinderMesh.position.copy(cylinderBody.position);
    cylinderMesh.quaternion.copy(cylinderBody.quaternion);
}

//===================================================================
// RESIZING THE RENDERED SCENE WHEN RESIZING THE WINDOW

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / this.window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//===================================================================
// SHOOTING FUNCTION

function shootBullet() {
    
    // BULLET IN THREE.JS
    bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);
    bulletMat = new THREE.MeshStandardMaterial({
        color: 0xffffff
    });
    bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
    bulletMesh.castShadow = true;
    bulletMesh.receiveShadow = true;

    scene.add(bulletMesh);

    // BULLET BODY
    bulletPhysMat = new CANNON.Material();

    bulletBody = new CANNON.Body({
        mass: 20,
        shape: new CANNON.Sphere(0.2),
        position: new CANNON.Vec3(
            camera.position.x,
            camera.position.y,
            camera.position.z + 50
        ),
        material: bulletPhysMat
    });
        // Air resistance
    bulletBody.linearDamping = 0.2;
        // Rotation
    bulletBody.angularVelocity.set(1, 1, 1);
    bulletBody.angularDamping = 0.5;
        // Velocity
    bulletBody.velocity.set(0, 0, -200);
    
    bullets.push({mesh: bulletMesh, body: bulletBody});
    
    world.addBody(bulletBody);
}
