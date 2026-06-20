'use client';

import { useRef, useEffect, useState } from 'react';
import { Renderer, Program, Triangle, Mesh } from 'ogl';

type Origin = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface SideRaysProps {
  speed?: number;
  rayColor1?: string;
  rayColor2?: string;
  intensity?: number;
  spread?: number;
  origin?: Origin;
  tilt?: number;
  saturation?: number;
  blend?: number;
  falloff?: number;
  opacity?: number;
  className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1];
};

const originToFlip = (origin: Origin): [number, number] => {
  switch (origin) {
    case 'top-left':     return [1, 0];
    case 'bottom-right': return [0, 1];
    case 'bottom-left':  return [1, 1];
    default:             return [0, 0]; // top-right
  }
};

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;
uniform float iSpeed;
uniform vec3  iRayColor1;
uniform vec3  iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 src, vec2 dir, vec2 coord, float sA, float sB, float spd) {
  vec2 v = coord - src;
  float c = dot(normalize(v), dir);
  return clamp(
    (0.45 + 0.15 * sin(c * sA + iTime * spd)) +
    (0.30 + 0.20 * cos(-c * sB + iTime * spd)),
    0.0, 1.0) *
    clamp((iResolution.x - length(v)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  if (iFlipX > 0.5) fc.x = iResolution.x - fc.x;
  if (iFlipY > 0.5) fc.y = iResolution.y - fc.y;

  vec2 coord  = vec2(fc.x, iResolution.y - fc.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tr = iTilt * 3.14159265 / 180.0;
  float cs = cos(tr); float sn = sin(tr);
  vec2 rel = coord - rayPos;
  vec2 tc  = vec2(rel.x*cs - rel.y*sn, rel.x*sn + rel.y*cs) + rayPos;

  float hs  = iSpread * 0.275;
  vec2 rd1  = normalize(vec2(cos(0.785398 + hs), sin(0.785398 + hs)));
  vec2 rd2  = normalize(vec2(cos(0.785398 - hs), sin(0.785398 - hs)));

  vec4 r1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rd1, tc, 36.2214, 21.11349, iSpeed);
  vec4 r2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rd2, tc, 22.3991, 18.0234,  iSpeed * 0.2);

  vec4 color = r1 * (1.0 - iBlend) * 0.9 + r2 * iBlend * 0.9;

  float dl = length(fc.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float br = iIntensity * 0.4 / pow(max(dl, 0.001), iFalloff);
  color.rgb *= br;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb  = mix(vec3(gray), color.rgb, iSaturation);
  color.a    = max(color.r, max(color.g, color.b)) * iOpacity;

  gl_FragColor = color;
}`;

export default function SideRays({
  speed      = 2.5,
  rayColor1  = '#ff6b6b',
  rayColor2  = '#9cecff',
  intensity  = 2.0,
  spread     = 2.0,
  origin     = 'top-right',
  tilt       = 0,
  saturation = 1.5,
  blend      = 0.65,
  falloff    = 1.6,
  opacity    = 1.0,
  className  = '',
}: SideRaysProps) {
  const containerRef       = useRef<HTMLDivElement>(null);
  const uniformsRef        = useRef<Record<string, { value: number | number[] }> | null>(null);
  const rendererRef        = useRef<Renderer | null>(null);
  const animationIdRef     = useRef<number | null>(null);
  const meshRef            = useRef<Mesh | null>(null);
  const cleanupRef         = useRef<(() => void) | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef        = useRef<IntersectionObserver | null>(null);

  // Intersection observer — only render when visible
  useEffect(() => {
    if (!containerRef.current) return;
    observerRef.current = new IntersectionObserver(
      ([e]) => setIsVisible(e.isIntersecting),
      { threshold: 0.1 }
    );
    observerRef.current.observe(containerRef.current);
    return () => observerRef.current?.disconnect();
  }, []);

  // WebGL init / cleanup
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;
    cleanupRef.current?.();

    let cancelled = false;

    const init = async () => {
      await new Promise<void>(r => setTimeout(r, 10));
      if (cancelled || !containerRef.current) return;

      const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, 2), alpha: true });
      rendererRef.current = renderer;
      const gl = renderer.gl;
      gl.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';

      while (containerRef.current.firstChild)
        containerRef.current.removeChild(containerRef.current.firstChild);
      containerRef.current.appendChild(gl.canvas);

      const [flipX, flipY] = originToFlip(origin);
      const uniforms: Record<string, { value: number | number[] }> = {
        iTime:       { value: 0 },
        iResolution: { value: [1, 1] },
        iSpeed:      { value: speed },
        iRayColor1:  { value: hexToRgb(rayColor1) },
        iRayColor2:  { value: hexToRgb(rayColor2) },
        iIntensity:  { value: intensity },
        iSpread:     { value: spread },
        iFlipX:      { value: flipX },
        iFlipY:      { value: flipY },
        iTilt:       { value: tilt },
        iSaturation: { value: saturation },
        iBlend:      { value: blend },
        iFalloff:    { value: falloff },
        iOpacity:    { value: opacity },
      };
      uniformsRef.current = uniforms;

      const geometry = new Triangle(gl);
      const program  = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms });
      const mesh     = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;

      const resize = () => {
        if (!containerRef.current) return;
        const { clientWidth: w, clientHeight: h } = containerRef.current;
        renderer.setSize(w, h);
        uniforms.iResolution.value = [w * renderer.dpr, h * renderer.dpr];
      };

      const loop = (t: number) => {
        if (!rendererRef.current || !uniformsRef.current || !meshRef.current) return;
        uniforms.iTime.value = t * 0.001;
        try { renderer.render({ scene: mesh }); } catch { return; }
        animationIdRef.current = requestAnimationFrame(loop);
      };

      window.addEventListener('resize', resize);
      resize();
      animationIdRef.current = requestAnimationFrame(loop);

      cleanupRef.current = () => {
        cancelled = true;
        if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        window.removeEventListener('resize', resize);
        try {
          renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
          renderer.gl.canvas.parentNode?.removeChild(renderer.gl.canvas);
        } catch {}
        rendererRef.current = uniformsRef.current = meshRef.current = null;
      };
    };

    init();
    return () => { cleanupRef.current?.(); cleanupRef.current = null; };
  }, [isVisible, speed, rayColor1, rayColor2, intensity, spread, origin, tilt, saturation, blend, falloff, opacity]);

  // Hot-update uniforms without reinit
  useEffect(() => {
    const u = uniformsRef.current;
    if (!u) return;
    u.iSpeed.value      = speed;
    u.iRayColor1.value  = hexToRgb(rayColor1);
    u.iRayColor2.value  = hexToRgb(rayColor2);
    u.iIntensity.value  = intensity;
    u.iSpread.value     = spread;
    const [fx, fy]      = originToFlip(origin);
    u.iFlipX.value      = fx;
    u.iFlipY.value      = fy;
    u.iTilt.value       = tilt;
    u.iSaturation.value = saturation;
    u.iBlend.value      = blend;
    u.iFalloff.value    = falloff;
    u.iOpacity.value    = opacity;
  }, [speed, rayColor1, rayColor2, intensity, spread, origin, tilt, saturation, blend, falloff, opacity]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
      className={className}
    />
  );
}
