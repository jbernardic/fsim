import "./style.css"
import * as BABYLON from "@babylonjs/core"
import "@babylonjs/loaders/glTF";
import { GridMaterial, SkyMaterial } from "@babylonjs/materials";

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);

  // camera
  const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  //lights
  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  // sky
  const skyMaterial = new SkyMaterial("skyMaterial", scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.inclination = 10;

  const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
  skybox.material = skyMaterial;

  // player
  const playerAsset = await BABYLON.ImportMeshAsync("models/player.glb", scene);
  let playerModel: BABYLON.AbstractMesh;
  for (const mesh of playerAsset.meshes) {
    if (mesh.parent == null) {
      playerModel = mesh;
    }
  }

  //terain
  const terrain = BABYLON.MeshBuilder.CreatePlane("plane", { size: 1000 }, scene);
  terrain.rotation.x = Math.PI / 2;
  terrain.material = new GridMaterial("terrainMaterial", scene);

  let pitchControl = 0;
  let yawControl = 0;
  scene.onKeyboardObservable.add((info) => {
    //PITCH
    if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "w") {
      pitchControl = 1;
    }
    else if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "s") {
      pitchControl = -1;
    }
    else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "w" && pitchControl == 1) {
      pitchControl = 0;
    }
    else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "s" && pitchControl == -1) {
      pitchControl = 0;
    }
    //YAW
    if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "a") {
      yawControl = -1;
    }
    else if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "d") {
      yawControl = 1;
    }
    else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "a" && yawControl == -1) {
      yawControl = 0;
    }
    else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "d" && yawControl == 1) {
      yawControl = 0;
    }
  });

  engine.runRenderLoop(function () {

    const PITCH_SPEED = 0.02; // radians per control unit per frame? Adjust based on input
    const YAW_SPEED = 0.02;
    const PLANE_SPEED = 50; // units per second
    const CAMERA_DISTANCE_BEHIND = 40;
    const CAMERA_DISTANCE_UP = 15;
    const CAMERA_TARGET_AHEAD = 50;
    const CAMERA_LERP_FACTOR = 0.3;

    playerModel.rotate(BABYLON.Axis.X, pitchControl * PITCH_SPEED, BABYLON.Space.LOCAL);
    playerModel.rotate(BABYLON.Axis.Y, yawControl * YAW_SPEED, BABYLON.Space.WORLD); // world space because I don't want roll to affect yaw

    const rollAngle = playerModel.rotationQuaternion.toEulerAngles().z; // limiting roll angle to [-0.2, 0.2]
    if (yawControl < 0 && rollAngle >= -0.2 || yawControl > 0 && rollAngle <= 0.2) {
      playerModel.rotate(BABYLON.Axis.Z, yawControl * YAW_SPEED * 0.3, BABYLON.Space.LOCAL);
    }

    //if player isn't moving yaw, slerp roll to 0
    if (yawControl == 0) {
      const euler = playerModel.rotationQuaternion.toEulerAngles();
      const targetQuat = BABYLON.Quaternion.RotationYawPitchRoll(
        euler.y,
        euler.x,
        0
      );
      playerModel.rotationQuaternion = BABYLON.Quaternion.Slerp(playerModel.rotationQuaternion, targetQuat, 0.1);
    }

    const forwardDirection = playerModel.forward;
    const deltaTime = scene.getEngine().getDeltaTime() / 1000.0; // convert ms to seconds
    const moveDistance = PLANE_SPEED * deltaTime;
    playerModel.position.addInPlace(forwardDirection.scale(moveDistance));

    // camera calculation
    const desiredCamPos = playerModel.position.clone();
    desiredCamPos.subtractInPlace(playerModel.forward.scale(CAMERA_DISTANCE_BEHIND));
    desiredCamPos.addInPlace(playerModel.up.scale(CAMERA_DISTANCE_UP));

    const desiredTarget = playerModel.position.add(playerModel.forward.scale(CAMERA_TARGET_AHEAD));

    camera.position = BABYLON.Vector3.Lerp(camera.position, desiredCamPos, CAMERA_LERP_FACTOR);
    camera.setTarget(desiredTarget);
    camera.upVector = BABYLON.Vector3.Up();

    scene.render();
  });
  // Watch for browser/canvas resize events
  window.addEventListener("resize", function () {
    engine.resize();
  });
}

main();
