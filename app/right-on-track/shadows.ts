import * as THREE from "three";

type Shader = Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0];

export function configureRailwayShadows(sun: THREE.DirectionalLight) {
	// Keep the light direction, but center a generous caster volume ahead of the train.
	sun.position.set(-96, 144, -22); sun.target.position.set(0, 0, -70);
	sun.shadow.mapSize.set(2048, 2048);
	Object.assign(sun.shadow.camera, { left: -165, right: 165, top: 145, bottom: -145, near: 0.5, far: 450 });
	sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = 0.04;
}

export function softenDistantShadows(shader: Shader) {
	shader.vertexShader = "varying vec3 shadowWorldPosition;\n" + shader.vertexShader;
	shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
		vec4 fadePosition = vec4(transformed, 1.0);
		#ifdef USE_INSTANCING
			fadePosition = instanceMatrix * fadePosition;
		#endif
		shadowWorldPosition = (modelMatrix * fadePosition).xyz;`);
	shader.fragmentShader = "varying vec3 shadowWorldPosition;\n" + shader.fragmentShader;
	const lighting = THREE.ShaderChunk.lights_fragment_begin.replace(
		"directionalLightShadow.shadowIntensity,",
		`directionalLightShadow.shadowIntensity *
		(1.0 - smoothstep(95.0, 175.0, -shadowWorldPosition.z)) *
		(1.0 - smoothstep(45.0, 70.0, abs(shadowWorldPosition.x))) *
		(1.0 - smoothstep(30.0, 55.0, shadowWorldPosition.z)),`,
	);
	shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", lighting);
}

export function fadeDistantScenery(shader: Shader) {
	// Opaque fog silhouettes would otherwise sit in front of the darker backdrop.
	// A fixed pixel dither lets distant objects dissolve without transparency sorting.
	shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
		float sceneryVisibility = 1.0 - smoothstep(140.0, 220.0, -shadowWorldPosition.z);
		float sceneryDither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
		if (sceneryDither > sceneryVisibility) discard;`);
}
