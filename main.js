import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import * as dat from 'dat.gui';
import CannonDebugger from 'cannon-es-debugger'
import WebGL from 'three/examples/jsm/capabilities/WebGL.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// VARIABLES DECLARATION
// Three.js main variables
var scene, camera, renderer;
var player = {height: 1.8, speed: 0.2, fast: 0, turnSpeed: Math.PI * 0.01, canJump: true, startJump: 0, coins: 0};
var playerPhysMat, playerBody;
var clock = new THREE.Clock();
// Loader for 3D models, Controls, Gui Controls
var loader, loadingManager, controls, datGUI, keyboard = {};
// Raycaster
var mouse, raycaster, intersects, intersectedObject, pickableObjects = [];
var selected;
// Helpers
var axes, grid, dLightHelper, cannonDebugger;
// Lights
var ambientLight, directionalLight;
var ambientLightFolder, directionalLightFolder;
var gunLight;
// Physic World
var world, timeStep;
// Floor
var floorGeo, floorMat, floorMesh, floorPhysMat, floorBody;
// Walls
var wallGeo, wallMat, wall1Mesh, wall2Mesh, wallPhysMat, wall1Body, wall2Body;
// Bullets
var bulletGeo, bulletMat, bulletMesh, bulletPhysMat, bulletBody, bullets = [];
const MAX_BULLETS = 10;
// Robot
var robotMesh, robotPhysMat, robotBody;
var robot = {vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0};
// Obstacles
var obstacles = [];
// Gun box
var gunBoxGeo, gunBoxMat, gunBoxMesh;
var medium_gun = {price: 5, bought: false, lock: null, texture: null};
var big_gun = {price: 20, bought: false, lock: null, texture: null};
// Labels
var labelGeo, labelMat, texture;
// Collisions groups
var GROUP_OBJECTS = 1;
var GROUP_BULLETS = 2;
var GROUP_PLAYER = 4;

// Loading screen
var RESOURCES_LOADED = false;

var loadingScreen = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight,
        0.1,
        100
    )
}

init();

function init() {

    //===================================================================
    // INITIALIZING THREE.JS

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
        // Setting the position
    camera.position.set(0, player.height, 30);
        // Looking at the origin of the scene
    camera.lookAt(0, player.height, 0);
    camera.rotation.order = 'YXZ';

    // Renderer
    renderer = new THREE.WebGLRenderer({antialias: false});
        // Fill the entire window, set color to black
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
        // Adding shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Raycaster
    mouse = new THREE.Vector2();
    raycaster = new THREE.Raycaster();

    //===================================================================
    // SETTING CONTROLS
    /*
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
    */
    //===================================================================
    // ADDING HELPERS

    // Visualize cartesian axes
    // axes = new THREE.AxesHelper(2);
    // scene.add(axes);

    // Visualize a grid on the floor
    // grid = new THREE.GridHelper(100, 10);
    // scene.add(grid);

    //===================================================================
    // SETTING THE LIGHTS

    // Ambient Light
    ambientLight = new THREE.AmbientLight(0x555555, 2)
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
    // dLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
    // scene.add(dLightHelper);

    gunLight = new THREE.RectAreaLight(0xffffff, 10, 6, 10);
    gunLight.position.set(40, 5, 0);
    gunLight.lookAt(40, 0, 0);
    scene.add(gunLight);

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
    // INITIALIZING THE PHYSIC WORLD

    world = new CANNON.World({
        // Gravity Force
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    timeStep = 1 / (60 * 1.5);

    //===================================================================
    // CANNON-ES-DEBUGGER

    //cannonDebugger = new CannonDebugger(scene, world);

    //===================================================================
    // BUILDING THE SCENE

    buildRoom();
    buildObstacles();

    //===================================================================
    // BODY OF THE PLAYER

    playerPhysMat = new CANNON.Material();

    playerBody = new CANNON.Body({
        mass: 70,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5)),
        position: new CANNON.Vec3(camera.position.x, 2, camera.position.z),
        material: playerPhysMat,
        collisionFilterGroup: GROUP_PLAYER,
        collisionFilterMask: GROUP_OBJECTS
    });
    playerBody.fixedRotation = true;
    playerBody.updateMassProperties();
    world.addBody(playerBody);

    const playerFloorContactMat = new CANNON.ContactMaterial(
        playerPhysMat,
        floorPhysMat,
        {restitution: 0},
        {friction: 0}
    );

    world.addContactMaterial(playerFloorContactMat);

    //===================================================================
    // LOADING OBJECTS

    loadingManager = new THREE.LoadingManager();

    loadingManager.onProgress = function(item, loaded, total) {
        console.log(item, loaded, total);
    }

    loadingManager.onLoad = function() {
        console.log("All resources loaded.");
        RESOURCES_LOADED = true;
    }

    loader = new GLTFLoader(loadingManager);

    loadGuns();

    spawnEnemy();
    
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
// KEYS LISTENER
window.addEventListener('keyup', function(event) {
    // Shooting case
    if (event.code === 'Space') shootBullet();
    else if (event.code === 'KeyR') {
        document.getElementById('reloading').style.visibility = "visible";
        setTimeout(reloadGuns, 1000);
        //reloadGuns();
    }
    else {
        keyboard[event.code] = false;
    }
});

window.addEventListener('keydown', function(event) {
    // This key is pressed
    keyboard[event.code] = true;
});

// Raycaster Listener
window.addEventListener('click', onMouseClick, false);

function onMouseClick(event) {
    event.preventDefault();  // Prevent default behavior

    document.getElementById("tutorial").style.visibility = "hidden";
    document.getElementById("pause").style.visibility = "hidden";
    document.body.requestPointerLock();

    // Update the raycaster with the camera and mouse position
    raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

    // Calculate objects intersecting the picking ray
    intersects = raycaster.intersectObjects(pickableObjects, true);

    // Reset the position of all pickable objects
    pickableObjects.forEach(obj => {
        if (obj != selected) obj.position.y = 1
    });

    // If there's an intersection, raise the selected object
    if (intersects.length > 0) {
        intersectedObject = intersects[0].object;

        // Traverse up to the top-level parent of the intersected object
        while (intersectedObject.parent && intersectedObject.parent.type !== 'Scene') {
            intersectedObject = intersectedObject.parent;
        }
        //console.log(intersectedObject.name);
        if (intersectedObject != selected) {

            switch(intersectedObject.name) {
                case 'littleGun':
                    document.getElementById("pistol").style.visibility = "visible";
                    document.getElementById("rifle").style.visibility = "hidden";
                    document.getElementById("grenade").style.visibility = "hidden";
                    intersectedObject.position.y += 2;
                    selected = intersectedObject;
                    pickableObjects.forEach(obj => {
                        if (obj != selected) obj.position.y = 1;
                    });
                    break;
                case 'mediumGun':
                    if (medium_gun.bought == false && player.coins >= medium_gun.price) {
                        player.coins -= medium_gun.price;
                        document.getElementById("coins").innerHTML = player.coins;
                        scene.remove(medium_gun.lock);
                        scene.remove(medium_gun.texture);
                        medium_gun.bought = true;
                    }
                    if (medium_gun.bought == true) {
                        document.getElementById("pistol").style.visibility = "hidden";
                        document.getElementById("rifle").style.visibility = "visible";
                        document.getElementById("grenade").style.visibility = "hidden";
                        intersectedObject.position.y += 2;
                        selected = intersectedObject;
                        pickableObjects.forEach(obj => {
                            if (obj != selected) obj.position.y = 1;
                        });
                    }
                    break;
                case 'bigGun':
                    if (big_gun.bought == false && player.coins >= big_gun.price) {
                        player.coins -= big_gun.price;
                        document.getElementById("coins").innerHTML = player.coins;
                        scene.remove(big_gun.lock);
                        scene.remove(big_gun.texture);
                        big_gun.bought = true;
                    }
                    if (big_gun.bought == true) {
                        document.getElementById("pistol").style.visibility = "hidden";
                        document.getElementById("rifle").style.visibility = "hidden";
                        document.getElementById("grenade").style.visibility = "visible";
                        intersectedObject.position.y += 2;
                        selected = intersectedObject;
                        pickableObjects.forEach(obj => {
                            if (obj != selected) obj.position.y = 1;
                        });
                    }
                    break;
            }
        }

    }

}

// Rotation camera with mouse

document.body.addEventListener('mousemove', (event) => {

    if (document.pointerLockElement === document.body) {

        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;

    }

} );

// Pause menu

document.addEventListener('pointerlockchange', function() {
    if (document.pointerLockElement === document.body) {
        document.getElementById("pause").style.visibility = "hidden";
    } else {
        document.getElementById("pause").style.visibility = "visible";
    }
});

//===================================================================
// ANIMATE FUNCTION

function animate() {

    if (RESOURCES_LOADED == false) {
        requestAnimationFrame(animate);
        renderer.render(loadingScreen.scene, loadingScreen.camera);
        return;
    }

    // Loop and keep things up to date
    requestAnimationFrame(animate);
    // Time between updates
    world.step(timeStep);
    // Update position and quaternion of objects w.r.t their body
    updatePhysics();
    // Move the camera
    playerMovement();
    // Move the robot
    robotMovement();
    // Update cannon-es-debugger
    //cannonDebugger.update();
    // Rotate guns
    pickableObjects.forEach( (gun) => {
        gun.rotation.y += 0.01;
    });
    // Actually render the scene
    renderer.render(scene, camera);
}

//===================================================================
// UPDATE PHYSICS FUNCTION

function updatePhysics() {
    // Bullets
    bullets.forEach((bullet) => {
        bullet.mesh.position.copy(bullet.body.position);
        bullet.mesh.quaternion.copy(bullet.body.quaternion);
    });
    // Camera
    camera.position.copy(playerBody.position);
    // Robot
    robotMesh.position.copy(robotBody.position);
    robotMesh.quaternion.copy(robotBody.quaternion);
}

//===================================================================
// RESIZING THE RENDERED SCENE WHEN RESIZING THE WINDOW

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / this.window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//===================================================================
// MOVEMENT FUNCTION

function playerMovement() {
    player.fast = 0;
    if (keyboard["KeyE"] && player.canJump) { // E key
        player.startJump = playerBody.position.y;
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.velocity.y = 30;
        player.canJump = false;
    }
    if (keyboard["KeyW"]) { // W key
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x -= Math.sin(camera.rotation.y) * player.fast;
        playerBody.position.z += -Math.cos(camera.rotation.y) * player.fast;
    }
    if (keyboard["KeyA"]) { // A key
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x -= Math.sin(camera.rotation.y + Math.PI/2) * player.fast;
        playerBody.position.z += -Math.cos(camera.rotation.y + Math.PI/2) * player.fast;
    }
    if (keyboard["KeyS"]) { // S key
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x += Math.sin(camera.rotation.y) * player.fast;
        playerBody.position.z -= -Math.cos(camera.rotation.y) * player.fast;
    }
    if (keyboard["KeyD"]) { // D key
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x -= Math.sin(camera.rotation.y - Math.PI/2) * player.fast;
        playerBody.position.z += -Math.cos(camera.rotation.y - Math.PI/2) * player.fast;
    }
    if (playerBody.position.y < -10) {
        playerBody.position.set(0, 5, 30);
    }
    if (Math.abs(playerBody.velocity.y) < 0.1) {
        player.canJump = true;
        player.startJump = 0;
    }
    if (playerBody.position.y - player.startJump >= 6) {
        playerBody.velocity.y = -10;
    }
}

//===================================================================
// MOVEMENT FUNCTION

function robotMovement() {



    if (robotBody.position.y < -10) {
        scene.remove(robotMesh);
        world.removeBody(robotBody);
        player.coins += 1;
        document.getElementById("coins").innerHTML = player.coins;
        spawnEnemy();
        playerBody.position.set(0, 5, 30);

        while (obstacles.length > 0) {
            let o = obstacles.pop();
            scene.remove(o.mesh);
            world.removeBody(o.body);
        }
        buildObstacles();
    }
}

//===================================================================
// BUILDING ROOM FUNCTION

function buildRoom() {

    // Plane in Three.js to build the floor
    floorGeo = new THREE.PlaneGeometry(100, 100);
    floorMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        //wireframe: true
    });
        // Building the floor
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.set(-.5*Math.PI, 0, 0);
        // Shadows: the floor doesn't cast shadows, only receives
    floorMesh.castShadow = false;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Body for the floor

        // Collisions depend on involved materials
    floorPhysMat = new CANNON.Material();

    floorBody = new CANNON.Body({
        // Static, it has mass: 0
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 50, 1)),
        material: floorPhysMat,
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
        // I need to rotate the plan to make it a floor
    floorBody.quaternion.setFromEuler(-.5*Math.PI, 0, 0);
    floorBody.position.set(0, -1, 0);
    world.addBody(floorBody);

    // Walls
    wallGeo = new THREE.PlaneGeometry(100, 20);
    wallMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide
    });

    wallPhysMat = new CANNON.Material();

    // First wall
    wall1Mesh = new THREE.Mesh(wallGeo, wallMat);
    wall1Mesh.position.set(0, 10, -50);
    wall1Mesh.castShadow = false;
    wall1Mesh.receiveShadow = true;
    scene.add(wall1Mesh);

    wall1Body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 10, 1)),
        material: wallPhysMat,
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    wall1Body.position.set(0, 10, -51);
    world.addBody(wall1Body);

    // Second wall
    wall2Mesh = new THREE.Mesh(wallGeo, wallMat);
    wall2Mesh.position.set(50, 10, 0);
    wall2Mesh.rotation.set(0, -.5*Math.PI, 0);
    wall2Mesh.castShadow = false;
    wall2Mesh.receiveShadow = true;
    scene.add(wall2Mesh);

    wall2Body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 10, 1)),
        material: wallPhysMat,
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    wall2Body.quaternion.setFromEuler(0, -.5*Math.PI, 0);
    wall2Body.position.set(51, 10, 0);
    world.addBody(wall2Body);
}

//===================================================================
// OBSTACLES BUILDING FUNCTION

function buildObstacles() {
    var buildPoss, obsHeight;
    for (let i = -48; i <= -4; i += 6) {
        for (let j = -48; j <= 48; j += 6) {
            buildPoss = Math.random();
            if (buildPoss > 0.8) {
                obsHeight = Math.random() * 10;
                var boxGeo = new THREE.BoxGeometry(3, obsHeight, 3);
                var boxMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff
                });
                var boxMesh = new THREE.Mesh(boxGeo, boxMat);
                boxMesh.position.set(i, 0, j);
                boxMesh.castShadow = true;
                boxMesh.receiveShadow = true;
                scene.add(boxMesh);

                // BODY FOR THE BOX (PHYSIC BOX)
                var boxBody = new CANNON.Body({
                    type: CANNON.Body.STATIC,
                    shape: new CANNON.Box(new CANNON.Vec3(1.5, obsHeight/2, 1.5)),
                    position: new CANNON.Vec3(i, 0, j),
                    material: wallPhysMat,
                    collisionFilterGroup: GROUP_OBJECTS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
                });
                world.addBody(boxBody);

                obstacles.push({mesh: boxMesh, body: boxBody});
            }
        }
    }
}

//===================================================================
// ENEMY SPAWN FUNCTION

function spawnEnemy() {
    loader.load('models/botDrone.gltf', function(gltf) {
        robotMesh = gltf.scene;
        robotMesh.traverse((child) => {
            if (child.isMesh) {
                child.castshadow = true;
                child.receiveShadow = true;
            }
        });
        robotMesh.scale.set(2, 2, 2);
        robotMesh.name = 'robot';
        scene.add(robotMesh);
    }, undefined, function(error) {
        console.error(error);
    });

    robotPhysMat = new CANNON.Material();

    robotBody = new CANNON.Body({
        mass: 20,
        shape: new CANNON.Sphere(3),
        position: new CANNON.Vec3(0, 5, 0),
        material: robotPhysMat
    });
    robotBody.quaternion.setFromEuler(0, .7*Math.PI, 0);
    world.addBody(robotBody);

    // Air resistance
    robotBody.linearDamping = 0.2; // [0, 1]
    }

//===================================================================
// GUNS LOADING FUNCTION

function loadGuns() {

    gunBoxGeo = new THREE.BoxGeometry(2, 0.3, 2);
    gunBoxMat = new THREE.MeshBasicMaterial({
        color: 0xffc000,
        //wireframe: true
    });

    //=================================================
    // BIG GUN

    loader.load('models/bigGun.gltf', function(gltf) {
        var gun = gltf.scene;
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castshadow = true;
                child.receiveShadow = true;
            }
        });
        pickableObjects.push(gun);
        gun.position.set(40, 1, -5);
        gun.scale.set(3, 3, 3);
        gun.name = 'bigGun';
        scene.add(gun);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('models/lock.gltf', function(gltf) {
        big_gun.lock = gltf.scene;
        big_gun.lock.traverse((child) => {
            if (child.isMesh) {
                child.castshadow = true;
                child.receiveShadow = true;
            }
        });
        big_gun.lock.position.set(40, 4, -5);
        big_gun.lock.scale.set(3, 3, 3);
        big_gun.lock.rotation.set(0, Math.PI, 0);
        scene.add(big_gun.lock);
    }, undefined, function(error) {
        console.error(error);
    });

    gunBoxMesh = new THREE.Mesh(gunBoxGeo, gunBoxMat);
    gunBoxMesh.castShadow = true;
    gunBoxMesh.receiveShadow = true;
    gunBoxMesh.position.set(40, 0.2, -5);
    scene.add(gunBoxMesh);

    labelGeo = new THREE.PlaneGeometry(4, 2);
    texture = new THREE.TextureLoader(loadingManager).load('images/coins20.png');
    labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    big_gun.texture = new THREE.Mesh(labelGeo, labelMat);
    big_gun.texture.rotation.set(0, -.5*Math.PI, 0);
    big_gun.texture.position.set(38.5, 5, -5);
    big_gun.texture.castShadow = true;
    big_gun.texture.receiveShadow = true;
    scene.add(big_gun.texture);

    //=================================================
    // MEDIUM GUN

    loader.load('models/mediumGun.gltf', function(gltf) {
        var gun = gltf.scene;
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castshadow = true;
                child.receiveShadow = true;
            }
        });
        pickableObjects.push(gun);
        gun.position.set(40, 1, 0);
        gun.scale.set(3, 3, 3);
        gun.name = 'mediumGun';
        scene.add(gun);
    }, undefined, function(error) {
        console.error(error);
    });

    loader.load('models/lock.gltf', function(gltf) {
        medium_gun.lock = gltf.scene;
        medium_gun.lock.traverse((child) => {
            if (child.isMesh) {
                child.castshadow = true;
                child.receiveShadow = true;
            }
        });
        medium_gun.lock.position.set(40, 4, 0);
        medium_gun.lock.scale.set(3, 3, 3);
        medium_gun.lock.rotation.set(0, Math.PI, 0);
        scene.add(medium_gun.lock);
    }, undefined, function(error) {
        console.error(error);
    });

    gunBoxMesh = new THREE.Mesh(gunBoxGeo, gunBoxMat);
    gunBoxMesh.castShadow = true;
    gunBoxMesh.receiveShadow = true;
    gunBoxMesh.position.set(40, 0.2, 0);
    scene.add(gunBoxMesh);

    labelGeo = new THREE.PlaneGeometry(4, 2);
    texture = new THREE.TextureLoader(loadingManager).load('images/coins5.png');
    labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    medium_gun.texture = new THREE.Mesh(labelGeo, labelMat);
    medium_gun.texture.rotation.set(0, -.5*Math.PI, 0);
    medium_gun.texture.position.set(38.5, 5, 0);
    medium_gun.texture.castShadow = true;
    medium_gun.texture.receiveShadow = true;
    scene.add(medium_gun.texture);

    //=================================================
    // LITTLE GUN

    loader.load('models/littleGun.gltf', function(gltf) {
        var gun = gltf.scene;
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castshadow = true;
                child.receiveShadow = true;
            }
        });
        pickableObjects.push(gun);
        gun.position.set(40, 3, 5);
        gun.scale.set(3, 3, 3);
        gun.name = 'littleGun';
        selected = gun;
        scene.add(gun);
    }, undefined, function(error) {
        console.error(error);
    });

    gunBoxMesh = new THREE.Mesh(gunBoxGeo, gunBoxMat);
    gunBoxMesh.castShadow = true;
    gunBoxMesh.receiveShadow = true;
    gunBoxMesh.position.set(40, 0.2, 5);
    scene.add(gunBoxMesh);

}

//===================================================================
// SHOOTING FUNCTION

function shootBullet() {

    if (bullets.length < MAX_BULLETS) {
        switch(selected.name) {
            case 'bigGun':
                bulletGeo = new THREE.SphereGeometry(1, 8, 8);

                bulletBody = new CANNON.Body({
                    mass: 20,
                    shape: new CANNON.Sphere(1),
                    position: new CANNON.Vec3(
                        camera.position.x, //meshes["gun"].position.x
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
                break;
            case 'mediumGun':
                bulletGeo = new THREE.SphereGeometry(0.5, 8, 8);

                bulletBody = new CANNON.Body({
                    mass: 10,
                    shape: new CANNON.Sphere(0.5),
                    position: new CANNON.Vec3(
                        camera.position.x, //meshes["gun"].position.x
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
                break;
            case 'littleGun':
                bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);

                bulletBody = new CANNON.Body({
                    mass: 5,
                    shape: new CANNON.Sphere(0.2),
                    position: new CANNON.Vec3(
                        camera.position.x, //meshes["gun"].position.x
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
                break;
            default:
                bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);

                bulletBody = new CANNON.Body({
                    mass: 10,
                    shape: new CANNON.Sphere(0.2),
                    position: new CANNON.Vec3(
                        camera.position.x, //meshes["gun"].position.x
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
        }
        
        // BULLET IN THREE.JS
        bulletMat = new THREE.MeshStandardMaterial({
            color: 0xffc000
        });
        bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
        bulletMesh.castShadow = true;
        bulletMesh.receiveShadow = true;

        scene.add(bulletMesh);

        // BULLET BODY
        bulletPhysMat = new CANNON.Material();
            // Air resistance
        bulletBody.linearDamping = 0.2;
            // Velocity
        var direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        var velocity = new CANNON.Vec3(
            direction.x, 
            direction.y,
            direction.z).scale(50 + player.fast);
        bulletBody.velocity.set(
            velocity.x, 
            velocity.y, 
            velocity.z);
        
        bullets.push({mesh: bulletMesh, body: bulletBody});
        
        world.addBody(bulletBody);

        // Bullets left
        document.getElementById("bullets").innerHTML = 10 - bullets.length;

        // ==============================================================
        // CONTACT BETWEEN MATERIALS

        const bulletFloorContactMat = new CANNON.ContactMaterial(
            bulletPhysMat,
            floorPhysMat,
            {restitution: 0.5}
        );

        world.addContactMaterial(bulletFloorContactMat);

        const bulletWallContactMat = new CANNON.ContactMaterial(
            bulletPhysMat,
            wallPhysMat,
            {restitution: 0.5}
        );

        world.addContactMaterial(bulletWallContactMat);
    }
}

//===================================================================
// RELOADING FUNCTION
function reloadGuns() {
    while (bullets.length > 0) {
        let b = bullets.pop();
        scene.remove(b.mesh);
        world.removeBody(b.body);
    }
    document.getElementById('reloading').style.visibility = "hidden";
    document.getElementById("bullets").innerHTML = 10;
}
