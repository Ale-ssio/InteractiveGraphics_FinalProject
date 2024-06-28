import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Variables declaration
// scene, camera and renderer of three.js
var scene, camera, renderer;
// loader for 3d models, orbit controls, gui controls
var loader, controls, guiControls, datGUI;
// helpers to visualize things
var axes, grid, cannonDebugger;
// lights
var ambientLight, directionalLight;
// floor mesh
var planeGeometry, planeMaterial, floor;
// 3d models loaded in the app
var haunter, shelves = [], walls = [];
var cans1 = [], cans2 = [], cans3 = [];
// cannon js world objects
var world, timeStep;
var floorBody;
// cannon js model bodies
var can1Bodies = [], can2Bodies = [], can3Bodies = [];
var shelfBodies = [], wallBodies = [];


// initial light to be able to reset values with gui controls
const initialLight = {
    lightX: -10,
    lightY: 10,
    lightZ: 20,
    intensity: 4
}

// call the main function
init();

function init() {
    //===================================================================
    // INITIALIZING THE SCENE
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        45, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        1000
    );
    renderer = new THREE.WebGLRenderer({antialias:true});

    //===================================================================
    // SETTING THE RENDERER
    // Fill the entire window with this app
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Adding shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    //===================================================================
    // SETTING ORBIT CONTROLS
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = 5;
    controls.maxDistance = 20;
    controls.minPolarangle = 0.5;
    controls.maxPolarAngle = 1.5;
    controls.autoRotate = false;
    controls.target = new THREE.Vector3(0, 1, 0);
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.RIGHT,
        MIDDLE: THREE.MOUSE.MIDDLE,
        RIGHT: THREE.MOUSE.LEFT
    }
    controls.update();

    //===================================================================
    // ADDING HELPERS
    axes = new THREE.AxesHelper(2);
    scene.add(axes);
    grid = new THREE.GridHelper(60, 5);
    scene.add(grid);

    //===================================================================
    // ADDING THE PLANES TO BUILD THE SCENE
    planeGeometry = new THREE.PlaneGeometry(1000, 1000);
    planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        side: THREE.DoubleSide,
        //wireframe: true
    });
    // Building the floor
    floor = new THREE.Mesh(planeGeometry, planeMaterial);
    //floor.rotation.x = -.5*Math.PI; // I will rotate the body
    floor.castShadow = false; // the floor doesn't need to cast shadows
    floor.receiveShadow = true;
    scene.add(floor);

    //===================================================================
    // SETTING THE CAMERA
    // Setting the camera position (out of the main objects)
    camera.position.set(0, 2, 6);
    // Look at the origine of the scene
    camera.lookAt(0, 0, 0);

    //===================================================================
    // SETTING datGUI CONTROLS
    guiControls = new function() {
        this.lightX = -10;
        this.lightY = 10;
        this.lightZ = 20;
        this.intensity = 4;
    }

    //===================================================================
    // SETTING THE LIGHTS
    // Adding ambient light
    // Ambient light doesn't support shadows
    ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);
    // Adding directional light
    directionalLight = new THREE.DirectionalLight(0xffffff, 4);
    directionalLight.position.set(-10, 10, 20);
    directionalLight.castShadow = true;    
    scene.add(directionalLight);

    //===================================================================
    // ADDING CONTROLS TO THE LIGHTS
    datGUI = new dat.GUI();

    datGUI.add(guiControls, 'lightX', -100, 100);
    datGUI.add(guiControls, 'lightY', 1, 100);
    datGUI.add(guiControls, 'lightZ', -100, 100);
    datGUI.add(guiControls, 'intensity', 0.01, 10);
    datGUI.add({reset: resetLight}, 'reset').name('Reset Values');

    //===================================================================
    // INITIALIZING THE PHYSICS WORLD
    world = new CANNON.World({
        // Setting the gravity force
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // Setting the Cannon Debug Renderer to help visualizing the physics
    cannonDebugger = new CannonDebugger(scene, world);

    //
    timeStep = 1 / 60;

    // Building the physic floor
    // The floor is static, so it has mass 0
    floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC, //mass 0
        shape: new CANNON.Plane()
    });
    floorBody.quaternion.setFromEuler(-.5*Math.PI, 0, 0);
    physicsWorld.addBody(floorBody);

    //====================================================================
    // LOADING OBJECTS
    loader = new GLTFLoader();
    //uploadObjects();

    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
    //const boxMaterial = new THREE.MeshNormalMaterial();
    //const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    //scene.add(boxMesh);

    const radius = 1;
    const sphereBody = new CANNON.Body({
        mass: 5,
        shape: new CANNON.Sphere(radius),
    });
    sphereBody.position.set(0, 7, 0);
    physicsWorld.addBody(sphereBody);

    const cannonDebugger = new CannonDebugger(scene, physicsWorld, {});
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    
    //===================================================================
    // DISPLAYING THE SCENE
    // Adding a <canvas> element to the HTML to display the scene
    document.body.appendChild(renderer.domElement);   

    //====================================================================
    // RENDERING THE SCENE
    if ( WebGL.isWebGLAvailable() ) {
        animate();
    } else {
        const warning = WebGL.getWebGLErrorMessage();
        document.getElementById( 'container' ).appendChild( warning );
    }
}

//====================================================================
// RENDER FUNCTION
// rendering the lights based on the current values of the gui
function render() {
    directionalLight.position.x = guiControls.lightX;
    directionalLight.position.y = guiControls.lightY;
    directionalLight.position.z = guiControls.lightZ;
    directionalLight.intensity = guiControls.intensity;
}

//====================================================================
// ANIMATE FUNCTION
// animate function to loop and keeps things up to date
function animate() {
    requestAnimationFrame(animate);
    render();
    //updatePhysics();
    controls.update();
    cannonDebugger.update();
    renderer.render(scene, camera);
}

//====================================================================
// UPDATE PHYSICS FUNCTION
// update the visual world to follow the physics simulation
function updatePhysics() {
    physicsWorld.step(timeStep);

    // Floor physics
    floor.position.copy(floorBody.position);
    floor.quaternion.copy(floorBody.quaternion);
    // Shelves physics
    shelfBodies.forEach((body, index) => {
        var smesh = shelves[index];
        smesh.position.copy(body.position);
        smesh.quaternion.copy(body.quaternion);
    });
    // Walls physics
    wallBodies.forEach((body, index) => {
        var wmesh = walls[index];
        wmesh.position.copy(body.position);
        wmesh.quaternion.copy(body.quaternion);
    });
    // Cans1 physics
    can1Bodies.forEach((body, index) => {
        var c1mesh = cans1[index];
        c1mesh.position.copy(body.position);
        c1mesh.quaternion.copy(body.quaternion);
    });
    // Cans2 physics
    can2Bodies.forEach((body, index) => {
        var c2mesh = cans2[index];
        c2mesh.position.copy(body.position);
        c2mesh.quaternion.copy(body.quaternion);
    });
    // Cans3 physics
    can3Bodies.forEach((body, index) => {
        var c3mesh = cans3[index];
        c3mesh.position.copy(body.position);
        c3mesh.quaternion.copy(body.quaternion);
    });
    /*
    // Crashed Can 1 physics
    ccan1.position.copy(ccan1Body.position);
    ccan1.quaternion.copy(ccan1Body.quaternion);
    // Crashed Can 2 physics
    ccan2.position.copy(ccan2Body.position);
    ccan2.quaternion.copy(ccan2Body.quaternion);
    */
}

//====================================================================
// RESIZING FUNCTION
// When resizing the window, the rendered scene adapts
$(window).resize(function() {
    var screen_width = window.innerWidth;
    var screen_height = window.innerHeight;
    camera.aspect = screen_width / screen_height;
    camera.updateProjectionMatrix();
    renderer.setSize(screen_width, screen_height);
});

//====================================================================
// LIGHT RESET FUNCTION
// reset button takes the gui light values to the initial values
function resetLight() {
    // Reset the light values in datGUI to the initial values
    guiControls.lightX = initialLight.lightX;
    guiControls.lightY = initialLight.lightY;
    guiControls.lightZ = initialLight.lightZ;
    guiControls.intensity = initialLight.intensity;
    // Update the datGUI controls
    for (let i in datGUI.__controllers) {
        datGUI.__controllers[i].updateDisplay();
    }
}

//====================================================================
// OBJECTS UPLOAD FUNCTION
// load 3d models from external gltf files or build objects with three.js geometry

// I need to find the dimensions of the models I imported

// let bbox = new THREE.Box3().setFromObject(haunter);
// let size = bbox.getSize(new THREE.Vector3());
// console.log(size);

/* ghost: Vector3 x: 0.6943981051445007
                  y: 0.5404094159603119, 
                  z: 0.7534211874008179*/

// I have 3 types of can, so I mantain 3 arrays to keep track of the cans of that type.
/* can1: Vector3 x: 0.30000001192092896
                 y: 0.3199999928474426
                 z: 0.30000001192092896*/
/* can2: Vector3 x: 0.24454095840454082
                 y: 0.40233200073242203
                 z: 0.24454095840454101*/
/* can3: Vector3 x: 0.18291839361190787 
                 y: 0.3541161060333251, 
                 z: 0.18291839361190795*/

// I also have 2 types of crashed cans:
/* ccan1: Vector3 x: 0.6943981051445007
                  y: 0.5404094159603119
                  z: 0.7534211874008179*/
/* ccan2: Vector3 x: 0.2471040040254593
                  y: 0.15999999642372129
                  z: 0.2471040040254593*/

function uploadObjects() {
    //====================================================================
    // Little ghost in the middle
    loader.load('./models/haunter.gltf', function(gltf) {
        haunter = gltf.scene;
        haunter.rotateY(-Math.PI);
        haunter.position.set(0, 2, 0);
        scene.add(haunter);

        // I visualize the box containing the object
        // let bbox = new THREE.Box3().setFromObject(haunter);
        // let helper = new THREE.Box3Helper(bbox, new THREE.Color(0, 255, 0));
        // scene.add(helper);
    
    }, undefined, function(error) {
        console.error(error);
    });
/*
    //====================================================================
    // Various shelves
    var boxGeometry = new THREE.BoxGeometry(2, 0.1, 1);
    var boxMaterial = new THREE.MeshStandardMaterial({
        color: 0xa1662f,
        side: THREE.DoubleSide
    });

    for (let i = -2; i <= 2; i += 4) {
        for (let j = 2.3; j >= 0; j -= 0.6) {
            var shelf = new THREE.Mesh(boxGeometry, boxMaterial);
            shelf.castShadow = true;
            shelf.receiveShadow = true;
            shelf.position.set(i, j, 0);
            scene.add(shelf);
            shelves.push(shelf);
            createShelfBody(shelf);
        }
    }

    //====================================================================
    // Shelves walls
    var wallGeometry = new THREE.BoxGeometry(0.1, 2.4, 1);

    for (let i = -3; i <= 3; i += 2) {
        var wall = new THREE.Mesh(wallGeometry, boxMaterial);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.position.set(i, 1.2, 0);
        scene.add(wall);
        walls.push(wall);
        createWallBody(wall);
    }
*/
    //====================================================================
    // Various cans, I want to put them in pseudo-random positions
    loader.load('./models/can.gltf', function(gltf) {
        var can1 = gltf.scene;
        can1.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can1.position.set(-2.5, 2.4, 0);
        scene.add(can1);
        cans1.push(can1);
        createCan1Body(can1);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can3.gltf', function(gltf) {
        var can2 = gltf.scene;
        can2.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can2.position.set(-1.8, 2.4, 0);
        can2.scale.set(0.3, 0.3, 0.3);
        scene.add(can2);
        cans3.push(can2);
        createCan3Body(can2);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can2.gltf', function(gltf) {
        var can3 = gltf.scene;
        can3.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can3.position.set(1.5, 2.4, 0);
        can3.scale.set(0.04, 0.04, 0.04);
        scene.add(can3);
        cans2.push(can3);
        createCan2Body(can3);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can3.gltf', function(gltf) {
        var can4 = gltf.scene;
        can4.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can4.position.set(2.3, 2.4, 0);
        can4.scale.set(0.3, 0.3, 0.3);
        scene.add(can4);
        cans3.push(can4);
        createCan3Body(can4);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can.gltf', function(gltf) {
        var can5 = gltf.scene;
        can5.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can5.position.set(-1.3, 1.8, 0);
        scene.add(can5);
        cans1.push(can5);
        createCan1Body(can5);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can2.gltf', function(gltf) {
        var can6 = gltf.scene;
        can6.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can6.position.set(2, 1.8, 0);
        can6.scale.set(0.04, 0.04, 0.04);
        scene.add(can6);
        cans2.push(can6);
        createCan2Body(can6);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can3.gltf', function(gltf) {
        var can7 = gltf.scene;
        can7.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can7.position.set(-2, 1.2, 0);
        can7.scale.set(0.3, 0.3, 0.3);
        scene.add(can7);
        cans3.push(can7);
        createCan3Body(can7);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can.gltf', function(gltf) {
        var can8 = gltf.scene;
        can8.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can8.position.set(2.4, 1.2, 0);
        scene.add(can8);
        cans1.push(can8);
        createCan1Body(can8);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can.gltf', function(gltf) {
        var can9 = gltf.scene;
        can9.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can9.position.set(-2.3, 0.6, 0);
        scene.add(can9);
        cans1.push(can9);
        createCan1Body(can9);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can2.gltf', function(gltf) {
        var can10 = gltf.scene;
        can10.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can10.position.set(-1.7, 0.6, 0);
        can10.scale.set(0.04, 0.04, 0.04);
        scene.add(can10);
        cans2.push(can10);
        createCan2Body(can10);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/can3.gltf', function(gltf) {
        var can11 = gltf.scene;
        can11.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can11.position.set(1.5, 0.6, 0);
        can11.scale.set(0.3, 0.3, 0.3);
        scene.add(can11);
        cans3.push(can11);
        createCan3Body(can11);
    }, undefined, function(error) {
        console.error(error);
    });
    
    loader.load('./models/can.gltf', function(gltf) {
        var can12 = gltf.scene;
        can12.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        can12.position.set(2.6, 0.6, 0);
        scene.add(can12);
        cans1.push(can12);
        createCan1Body(can12);
    }, undefined, function(error) {
        console.error(error);
    });

    //====================================================================
    /*
    loader.load('./models/crashedCan.gltf', function(gltf) {
        ccan1 = gltf.scene;
        ccan1.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        ccan1.position.set(2.5, 0.1, 1);
        ccan1.rotateY(Math.PI / 2);
        ccan1.scale.set(3, 3, 3);
        scene.add(ccan1);

        var ccan1Shape = new CANNON.Box(new CANNON.Vec3(0.35, 0.3, 0.4));
        ccan1Body = new CANNON.Body({mass:0.1, shape:ccan1Shape});
        ccan1Body.position = ccan1.position;
        physicsWorld.addBody(ccan1Body);

    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('./models/crashedCan2.gltf', function(gltf) {
        ccan2 = gltf.scene;
        ccan2.traverse((child) => {
            if (child.isMesh) { // cast and receive shadows from each submesh of the model
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        ccan2.rotateX(Math.PI / 2);
        ccan2.position.set(-2.4, 0.1, 1.5);
        scene.add(ccan2);

        var ccan2Shape = new CANNON.Box(new CANNON.Vec3(0.13, 0.08, 0.13));
        ccan2Body = new CANNON.Body({mass:0.1, shape:ccan2Shape});
        ccan2Body.position = ccan2.position;
        physicsWorld.addBody(ccan2Body);

    }, undefined, function(error) {
        console.error(error);
    });
    */
}

//====================================================================
// SHELF BODY CREATION FUNCTION
// Create the body for the shelf passed as argument, then append to the array
function createShelfBody(s) {
    const halfExtents = new CANNON.Vec3(1, 0.05, 0.5);
    const sShape = new CANNON.Box(halfExtents);
    const sBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: sShape,
        position: new CANNON.Vec3(s.position.x, s.position.y, s.position.z)
    });
    physicsWorld.addBody(sBody);
    shelfBodies.push(sBody);
}

//====================================================================
// WALL BODY CREATION FUNCTION
// Create the body for the wall passed as argument, then append to the array
function createWallBody(w) {
    const halfExtents = new CANNON.Vec3(0.05, 0.7, 0.5);
    const wShape = new CANNON.Box(halfExtents);
    const wBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: wShape,
        position: new CANNON.Vec3(w.position.x, w.position.y, w.position.z)
    });
    physicsWorld.addBody(wBody);
    wallBodies.push(wBody);
}

//====================================================================
// CAN1 BODY CREATION FUNCTION
// Create the body for the type 1 can passed as argument, then append to the array
function createCan1Body(c1) {
    const radiusTop = 0.30;
    const radiusBottom = 0.30;
    const height = 0.32;
    const numSegments = 12;
    const c1Shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments);
    const c1Body = new CANNON.Body({
        mass:1, 
        shape:c1Shape,
        position: new CANNON.Vec3(c1.position.x, c1.position.y, c1.position.z)
    });
    physicsWorld.addBody(c1Body);
    can1Bodies.push(c1Body);
}

//====================================================================
// CAN2 BODY CREATION FUNCTION
// Create the body for the type 2 can passed as argument, then append to the array
function createCan2Body(c2) {
    const radiusTop = 0.25;
    const radiusBottom = 0.25;
    const height = 0.40;
    const numSegments = 12;
    const c2Shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments);
    const c2Body = new CANNON.Body({
        mass:0.5, 
        shape:c2Shape,
        position: new CANNON.Vec3(c2.position.x, c2.position.y, c2.position.z)
    });
    physicsWorld.addBody(c2Body);
    can2Bodies.push(c2Body);
}

//====================================================================
// CAN3 BODY CREATION FUNCTION
// Create the body for the type 3 can passed as argument, then append to the array
function createCan3Body(c3) {
    const radiusTop = 0.18;
    const radiusBottom = 0.18;
    const height = 0.36;
    const numSegments = 12;
    const c3Shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments);
    const c3Body = new CANNON.Body({
        mass:0.2, 
        shape:c3Shape,
        position: new CANNON.Vec3(c3.position.x, c3.position.y, c3.position.z)
    });
    physicsWorld.addBody(c3Body);
    can3Bodies.push(c3Body);
}
