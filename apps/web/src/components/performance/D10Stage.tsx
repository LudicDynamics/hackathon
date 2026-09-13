import React, { useEffect, useRef, useState } from 'react';
import { diceStageDisplay } from '../../lib/d10-display.js';
import { useStill } from '../../lib/motion.js';
import './d10-stage.css';

const modelUrl = new URL('../../../../../assets/models/arcane-d10/noctiluca-d10.glb', import.meta.url).href;

const trayTextureUrl = new URL('../../assets/textures/dice-tray-suede.png', import.meta.url).href;

interface Props {
  dice: string;
  integrated?: boolean;
  rolls?: number[];
  settled: boolean;
  onLanded?: () => void;
}

/** Bounded WebGL surface, loaded on demand. Animation never generates a score. */
export function D10Stage({ dice, rolls, settled, onLanded, integrated = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;
  const still = useStill();
  const [fallback, setFallback] = useState(false);
  const display = diceStageDisplay(dice, rolls);
  const key = JSON.stringify([dice, rolls]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false, finished = false, frame = 0;
    let teardown = () => {};
    const complete = () => {
      if (cancelled || finished || !rolls) return;
      finished = true;
      landed.current?.();
    };
    // Network/WebGL failure must never hide a committed result indefinitely.
    const watchdog = window.setTimeout(() => { setFallback(true); complete(); }, 6000);
    setFallback(false);
    if (!display) {
      setFallback(true);
      const timer = window.setTimeout(complete, still ? 180 : 1200);
      return () => { cancelled = true; clearTimeout(timer); clearTimeout(watchdog); };
    }
    void (async () => {
      try {
        const [T, { GLTFLoader }, { RoomEnvironment }, { d10Landing }, { simulateD10Throw, d6Landing, D6_VALUES }] = await Promise.all([
          import('three'), import('three/addons/loaders/GLTFLoader.js'),
          import('three/addons/environments/RoomEnvironment.js'), import('../../lib/d10-pose.js'), import('../../lib/d10-physics.js'),
        ]);
        if (cancelled) return;
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setSize(element.clientWidth || 480, 260);
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.65;
        element.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, (element.clientWidth || 480) / 260, .1, 100);
        camera.position.set(0, -1.2, 15); camera.lookAt(0, 0, 0);
        const pmrem = new T.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        const environment = pmrem.fromScene(room);
        room.dispose(); pmrem.dispose();
        scene.environment = environment.texture;
        scene.add(new T.HemisphereLight(0xddd2ff, 0x21102f, 2));
        const light = new T.DirectionalLight(0xffe5b0, 4);
        light.position.set(-3, 5, 6); scene.add(light);
        const resize = new ResizeObserver(() => {
          const width = element.clientWidth || 480;
          renderer.setSize(width, 260); camera.aspect = width / 260; camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        });
        resize.observe(element);
        const geometries = new Set<import('three').BufferGeometry>();
        const materials = new Set<import('three').Material>();
        const textures = new Set<import('three').Texture>();
        const collect = (object: import('three').Object3D) => object.traverse(node => {
          if (!(node instanceof T.Mesh)) return;
          geometries.add(node.geometry);
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
          }
        });
        teardown = () => {
          resize.disconnect(); cancelAnimationFrame(frame);
          geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
          environment.dispose(); renderer.dispose(); renderer.domElement.remove();
        };
        const gltf = display.faces === 6 ? { scene: new T.Group() } : await new GLTFLoader().loadAsync(modelUrl);
        if (display.faces === 6) {
          const faceMaterials = D6_VALUES.map(value => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#e7d8b8'; ctx.fillRect(0, 0, 256, 256);
            ctx.strokeStyle = '#aa9068'; ctx.lineWidth = 5; ctx.strokeRect(10, 10, 236, 236);
            ctx.fillStyle = '#352c40'; ctx.font = 'bold 150px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(value), 128, 138);
            const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
            return new T.MeshStandardMaterial({ map: texture, roughness: .65 });
          });
          gltf.scene.add(new T.Mesh(new T.BoxGeometry(1.6, 1.6, 1.6), faceMaterials));
        }
        collect(gltf.scene);
        if (cancelled || finished) { teardown(); return; }
        clearTimeout(watchdog);
        const size = new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3());
        const scale = display.faces === 6 ? 1 : 2.7 / Math.max(size.x, size.y, size.z);
        const objects = display.digits.map((digit, i) => {
          const pivot = new T.Group();
          const mesh = gltf.scene.clone(true); mesh.scale.multiplyScalar(scale); pivot.add(mesh);
          scene.add(pivot);
          return { pivot, target: display.faces === 6 ? d6Landing(digit) : d10Landing(digit), x: display.digits.length === 2 ? (i === 0 ? -1.65 : 1.65) : 0 };
        });
        // Floor receives shadows; the bounded tray is also the physical boundary.
        renderer.shadowMap.enabled = true;
        light.castShadow = true;
        light.shadow.mapSize.set(512, 512);
        gltf.scene.traverse(node => { if (node instanceof T.Mesh) node.castShadow = true; });
        objects.forEach(({ pivot }) => pivot.traverse(node => { if (node instanceof T.Mesh) node.castShadow = true; }));
        // User-selected suede texture supplies the cloth grain and relief.
        const nap = await new T.TextureLoader().loadAsync(trayTextureUrl);
        textures.add(nap);
        if (cancelled) { teardown(); return; }
        nap.colorSpace = T.SRGBColorSpace;
        nap.wrapS = nap.wrapT = T.RepeatWrapping;
        nap.repeat.set(2, 1);
        nap.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const velvet = new T.MeshPhysicalMaterial({ color: 0x9473cf, map: nap, roughness: 1,
          transparent: true, opacity: .78, bumpMap: nap, bumpScale: .025,
          sheen: 1, sheenColor: new T.Color(0x9362bc), sheenRoughness: .85, side: T.DoubleSide });
        const outline = new T.Shape();
        outline.moveTo(-4.1, -2.2); outline.lineTo(4.1, -2.2);
        outline.quadraticCurveTo(4.5, -2.2, 4.5, -1.8); outline.lineTo(4.5, 1.8);
        outline.quadraticCurveTo(4.5, 2.2, 4.1, 2.2); outline.lineTo(-4.1, 2.2);
        outline.quadraticCurveTo(-4.5, 2.2, -4.5, 1.8); outline.lineTo(-4.5, -1.8);
        outline.quadraticCurveTo(-4.5, -2.2, -4.1, -2.2);
        const floor = new T.Mesh<import('three').ShapeGeometry, import('three').Material>(new T.ShapeGeometry(outline), velvet);
        const floorUV = floor.geometry.getAttribute('uv');
        for (let i = 0; i < floorUV.count; i++) floorUV.setXY(i, (floorUV.getX(i) + 4.5) / 9, (floorUV.getY(i) + 2.2) / 4.4);
        floorUV.needsUpdate = true;
        floor.position.z = -.025; floor.receiveShadow = true; scene.add(floor); collect(floor);
        const edge = outline.getPoints(12);
        const railPositions: number[] = [], railIndices: number[] = [];
        edge.forEach(p => railPositions.push(p.x, p.y, 0, p.x * 1.06, p.y * 1.12, 1.3));
        for (let i = 0; i < edge.length - 1; i++) {
          const n = i * 2; railIndices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
        }
        const railGeometry = new T.BufferGeometry();
        railGeometry.setAttribute('position', new T.Float32BufferAttribute(railPositions, 3));
        const railUV: number[] = [];
        edge.forEach(p => railUV.push((p.x + 4.5) / 9, (p.y + 2.2) / 4.4, (p.x * 1.06 + 4.5) / 9, (p.y * 1.12 + 2.2) / 4.4));
        railGeometry.setAttribute('uv', new T.Float32BufferAttribute(railUV, 2));
        railGeometry.setIndex(railIndices); railGeometry.computeVertexNormals();
        const rails = new T.Mesh(railGeometry, velvet.clone());
        rails.material.opacity = .55; scene.add(rails); collect(rails);
        if (integrated) {
          rails.visible = false;
          const shadow = new T.ShadowMaterial({ opacity: .3 });
          materials.add(shadow);
          floor.material = shadow;
        }
        const seam = new T.LineLoop(new T.BufferGeometry().setFromPoints(edge.map(p => new T.Vector3(p.x * 1.06, p.y * 1.12, 1.31))),
          new T.LineDashedMaterial({ color: 0xb295cd, transparent: true, opacity: .55, dashSize: .07, gapSize: .065 }));
        seam.visible = !integrated;
        seam.computeLineDistances(); scene.add(seam);
        geometries.add(seam.geometry); materials.add(seam.material);
        let trajectory: Awaited<ReturnType<typeof simulateD10Throw>> | undefined;
        if (rolls && !still) {
          for (let attempt = 0; attempt < 3; attempt++) {
            try { trajectory = await simulateD10Throw(display.digits, undefined, () => cancelled, display.faces); break; }
            catch (error) { if (cancelled || attempt === 2) throw error; }
          }
        }
        if (cancelled) return;
        const started = performance.now();
        const duration = trajectory ? (trajectory.length - 1) / 60 * 1000 : 180;
        const tick = (now: number) => {
          if (cancelled) return;
          const p = rolls ? Math.max(0, Math.min(1, (now - started) / duration)) : 1;
          objects.forEach(({ pivot, target, x }, i) => {
            if (trajectory) {
              const at = p * (trajectory.length - 1), lower = Math.floor(at), upper = Math.min(lower + 1, trajectory.length - 1);
              const a = trajectory[lower][i], b = trajectory[upper][i];
              pivot.position.fromArray(a.position).lerp(new T.Vector3(...b.position), at - lower);
              pivot.quaternion.fromArray(a.rotation).slerp(new T.Quaternion(...b.rotation), at - lower);
            } else {
              pivot.quaternion.copy(target); pivot.position.set(x, 0, 1);
            }
          });
          if (!document.hidden) renderer.render(scene, camera);
          if (p < 1) frame = requestAnimationFrame(tick);
          else { renderer.render(scene, camera); complete(); }
        };
        frame = requestAnimationFrame(tick);
      } catch (error) {
        if (cancelled) return;
        console.warn('D10 rendering unavailable; showing the authoritative numeric result.', error);
        teardown(); clearTimeout(watchdog); setFallback(true); complete();
      }
    })();
    return () => { cancelled = true; clearTimeout(watchdog); teardown(); };
  }, [key, still, integrated]);

  return <div className="d10-stage" aria-label={dice}>
    <div ref={host} className="d10-stage__canvas" aria-hidden="true" style={{ display: fallback ? 'none' : undefined }} />
    {fallback && <div className="d10-stage__fallback">{settled ? rolls?.join(' · ') : '…'}</div>}
    <div className="d10-stage__labels">
      {(display?.labels ?? [dice]).map((label, i) => <span key={i}>{label}{settled && display ? ` · ${display.digits[i]}` : ''}</span>)}
    </div>
    {settled && display && <output className="d10-stage__reading">{display.reading}</output>}
  </div>;
}
