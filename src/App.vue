<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import QRCodeStyling from 'qr-code-styling'

// ================= UTILIDADES DE CONVERSIÓN DE COLOR (HEX <-> HSL) =================
function hexToHsl(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
  if (!result) return { h: 0, s: 0, l: 0 }
  
  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

// ================= ESTADOS REACTIVOS PRINCIPALES =================
const qrText = ref('https://open-qr.com')
const qrMargin = ref(10)
const logoUrl = ref<string | null>(null)
const logoSize = ref(0.3)

const qrColorType = ref<'single' | 'gradient'>('single')
const qrColor = ref('#254e75')
const qrColor2 = ref('#4f46e5')
const qrGradientRotation = ref(0)

const bgColor = ref('#ffffff')

const eyeFrameColorType = ref<'single' | 'gradient'>('single')
const eyeFrameColor = ref('#000000')
const eyeFrameColor2 = ref('#2563eb')
const eyeFrameRotation = ref(0)

const eyeDotColorType = ref<'single' | 'gradient'>('single')
const eyeDotColor = ref('#000000')
const eyeDotColor2 = ref('#1d4ed8')
const eyeDotRotation = ref(0)

const activeHslPanel = ref<string | null>(null)
function toggleHslPanel(panelName: string) {
  activeHslPanel.value = activeHslPanel.value === panelName ? null : panelName
}

const hslStates = ref({
  qr: { h: 210, s: 51, l: 30 },
  qr2: { h: 244, s: 79, l: 58 },
  bg: { h: 0, s: 0, l: 100 },
  ef: { h: 0, s: 0, l: 0 },
  ef2: { h: 221, s: 83, l: 53 },
  ed: { h: 0, s: 0, l: 0 },
  ed2: { h: 221, s: 76, l: 48 }
})

const dotOptions = [
  { id: 'square', name: 'Cuadrados (Tradicional)', shapeClass: 'rounded-none' },
  { id: 'dots', name: 'Círculos (Moderno)', shapeClass: 'rounded-full' },
  { id: 'rounded', name: 'Bordes Redondeados', shapeClass: 'rounded-[4px]' },
  { id: 'extra-rounded', name: 'Esferas Suaves', shapeClass: 'rounded-[8px]' },
  { id: 'classy', name: 'Líneas Estilizadas', shapeClass: 'rounded-tl-xl rounded-br-xl' },
  { id: 'classy-rounded', name: 'Líneas Redondeadas', shapeClass: 'rounded-tr-full rounded-bl-xl' },
] as const

const eyeFrameOptions = [
  { id: 'square', name: 'Cuadrado Angular', shapeClass: 'rounded-none' },
  { id: 'dot', name: 'Círculo Perfecto', shapeClass: 'rounded-full' },
  { id: 'extra-rounded', name: 'Esquinas Suaves', shapeClass: 'rounded-[6px]' },
  { id: 'outrounded', name: 'Corte Dinámico', shapeClass: 'rounded-tl-xl rounded-br-xl' },
] as const

const eyeDotOptions = [
  { id: 'square', name: 'Centro Cuadrado', shapeClass: 'rounded-none' },
  { id: 'dot', name: 'Centro Esférico', shapeClass: 'rounded-full' },
] as const

const selectedDotType = ref(dotOptions[1])
const selectedEyeFrameType = ref(eyeFrameOptions[1])
const selectedEyeDotType = ref(eyeDotOptions[1])

const isDropdownOpen = ref(false)
const isEyeFrameDropdownOpen = ref(false)
const isEyeDotDropdownOpen = ref(false)
const isDownloadDropdownOpen = ref(false)

const qrContainer = ref<HTMLElement | null>(null)
let qrCode: QRCodeStyling | null = null
let debounceTimeout: ReturnType<typeof setTimeout> | null = null

const LOCAL_STORAGE_KEY = 'open_qr_customizer_state'

function buildQrOptions() {
  return {
    width: 240,
    height: 240,
    type: 'svg' as const,
    data: qrText.value || ' ',
    image: logoUrl.value || undefined,
    margin: qrMargin.value,
    backgroundOptions: { color: bgColor.value },
    imageOptions: { hideBackgroundDots: true, imageSize: logoSize.value, margin: 5 },
    dotsOptions: {
      type: selectedDotType.value.id as any,
      color: qrColorType.value === 'single' ? qrColor.value : undefined,
      gradient: qrColorType.value === 'gradient' ? {
        type: 'linear' as const,
        rotation: (qrGradientRotation.value * Math.PI) / 180,
        colorStops: [{ offset: 0, color: qrColor.value }, { offset: 1, color: qrColor2.value }]
      } : undefined
    },
    cornersSquareOptions: {
      type: selectedEyeFrameType.value.id as any,
      color: eyeFrameColorType.value === 'single' ? eyeFrameColor.value : undefined,
      gradient: eyeFrameColorType.value === 'gradient' ? {
        type: 'linear' as const,
        rotation: (eyeFrameRotation.value * Math.PI) / 180,
        colorStops: [{ offset: 0, color: eyeFrameColor.value }, { offset: 1, color: eyeFrameColor2.value }]
      } : undefined
    },
    cornersDotOptions: {
      type: selectedEyeDotType.value.id as any,
      color: eyeDotColorType.value === 'single' ? eyeDotColor.value : undefined,
      gradient: eyeDotColorType.value === 'gradient' ? {
        type: 'linear' as const,
        rotation: (eyeDotRotation.value * Math.PI) / 180,
        colorStops: [{ offset: 0, color: eyeDotColor.value }, { offset: 1, color: eyeDotColor2.value }]
      } : undefined
    }
  }
}

function saveToLocalStorage() {
  const payload = {
    qrText: qrText.value, qrMargin: qrMargin.value, logoUrl: logoUrl.value, logoSize: logoSize.value,
    qrColorType: qrColorType.value, qrColor: qrColor.value, qrColor2: qrColor2.value, qrGradientRotation: qrGradientRotation.value,
    bgColor: bgColor.value,
    eyeFrameColorType: eyeFrameColorType.value, eyeFrameColor: eyeFrameColor.value, eyeFrameColor2: eyeFrameColor2.value, eyeFrameRotation: eyeFrameRotation.value,
    eyeDotColorType: eyeDotColorType.value, eyeDotColor: eyeDotColor.value, eyeDotColor2: eyeDotColor2.value, eyeDotRotation: eyeDotRotation.value,
    dotTypeId: selectedDotType.value.id, eyeFrameTypeId: selectedEyeFrameType.value.id, eyeDotTypeId: selectedEyeDotType.value.id
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
}

function loadFromPayload(config: any) {
  if (!config) return
  if (config.qrText !== undefined) qrText.value = config.qrText
  if (config.qrMargin !== undefined) qrMargin.value = config.qrMargin
  if (config.logoUrl !== undefined) logoUrl.value = config.logoUrl
  if (config.logoSize !== undefined) logoSize.value = config.logoSize
  if (config.qrColorType !== undefined) qrColorType.value = config.qrColorType
  if (config.qrColor !== undefined) qrColor.value = config.qrColor
  if (config.qrColor2 !== undefined) qrColor2.value = config.qrColor2
  if (config.qrGradientRotation !== undefined) qrGradientRotation.value = config.qrGradientRotation
  if (config.bgColor !== undefined) bgColor.value = config.bgColor
  if (config.eyeFrameColorType !== undefined) eyeFrameColorType.value = config.eyeFrameColorType
  if (config.eyeFrameColor !== undefined) eyeFrameColor.value = config.eyeFrameColor
  if (config.eyeFrameColor2 !== undefined) eyeFrameColor2.value = config.eyeFrameColor2
  if (config.eyeFrameRotation !== undefined) eyeFrameRotation.value = config.eyeFrameRotation
  if (config.eyeDotColorType !== undefined) eyeDotColorType.value = config.eyeDotColorType
  if (config.eyeDotColor !== undefined) eyeDotColor.value = config.eyeDotColor
  if (config.eyeDotColor2 !== undefined) eyeDotColor2.value = config.eyeDotColor2
  if (config.eyeDotRotation !== undefined) eyeDotRotation.value = config.eyeDotRotation

  if (config.dotTypeId) { const m = dotOptions.find(o => o.id === config.dotTypeId); if (m) selectedDotType.value = m }
  if (config.eyeFrameTypeId) { const m = eyeFrameOptions.find(o => o.id === config.eyeFrameTypeId); if (m) selectedEyeFrameType.value = m }
  if (config.eyeDotTypeId) { const m = eyeDotOptions.find(o => o.id === config.eyeDotTypeId); if (m) selectedEyeDotType.value = m }

  syncAllHslFromHex()
}

function syncAllHslFromHex() {
  hslStates.value.qr = hexToHsl(qrColor.value)
  hslStates.value.qr2 = hexToHsl(qrColor2.value)
  hslStates.value.bg = hexToHsl(bgColor.value)
  hslStates.value.ef = hexToHsl(eyeFrameColor.value)
  hslStates.value.ef2 = hexToHsl(eyeFrameColor2.value)
  hslStates.value.ed = hexToHsl(eyeDotColor.value)
  hslStates.value.ed2 = hexToHsl(eyeDotColor2.value)
}

onMounted(() => {
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (cached) {
    try { loadFromPayload(JSON.parse(cached)) } catch (e) { console.error(e) }
  } else {
    syncAllHslFromHex()
  }

  qrCode = new QRCodeStyling(buildQrOptions())
  if (qrContainer.value) qrCode.append(qrContainer.value)
})

watch([
  qrText, qrMargin, logoUrl, logoSize, qrColorType, qrColor, qrColor2, qrGradientRotation,
  bgColor, eyeFrameColorType, eyeFrameColor, eyeFrameColor2, eyeFrameRotation,
  eyeDotColorType, eyeDotColor, eyeDotColor2, eyeDotRotation, selectedDotType, selectedEyeFrameType, selectedEyeDotType
], () => {
  saveToLocalStorage()
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    if (qrCode) qrCode.update(buildQrOptions())
  }, 80)
})

const updateHexFromHsl = (key: keyof typeof hslStates.value, refTarget: any) => {
  const target = hslStates.value[key]
  if (key === 'qr') qrColor.value = hslToHex(target.h, target.s, target.l)
  if (key === 'qr2') qrColor2.value = hslToHex(target.h, target.s, target.l)
  if (key === 'bg') bgColor.value = hslToHex(target.h, target.s, target.l)
  if (key === 'ef') eyeFrameColor.value = hslToHex(target.h, target.s, target.l)
  if (key === 'ef2') eyeFrameColor2.value = hslToHex(target.h, target.s, target.l)
  if (key === 'ed') eyeDotColor.value = hslToHex(target.h, target.s, target.l)
  if (key === 'ed2') eyeDotColor2.value = hslToHex(target.h, target.s, target.l)
}

watch(qrColor, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.qr = hexToHsl(hx) })
watch(qrColor2, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.qr2 = hexToHsl(hx) })
watch(bgColor, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.bg = hexToHsl(hx) })
watch(eyeFrameColor, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.ef = hexToHsl(hx) })
watch(eyeFrameColor2, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.ef2 = hexToHsl(hx) })
watch(eyeDotColor, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.ed = hexToHsl(hx) })
watch(eyeDotColor2, (hx) => { if (/^#[0-9A-F]{6}$/i.test(hx)) hslStates.value.ed2 = hexToHsl(hx) })

const handleLogoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const reader = new FileReader()
    reader.onload = (e) => { logoUrl.value = e.target?.result as string }
    reader.readAsDataURL(target.files[0])
  }
}

const saveConfiguration = () => {
  const blob = new Blob([localStorage.getItem(LOCAL_STORAGE_KEY) || '{}'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `qr-custom-template.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const triggerConfigFileUpload = () => {
  const el = document.getElementById('import-config-file')
  if (el) el.click()
}

const loadConfiguration = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        loadFromPayload(parsed)
      } catch {
        alert('Archivo de configuración JSON corrupto o no válido.')
      }
    }
    reader.readAsText(target.files[0])
    target.value = '' 
  }
}

const downloadAs = (format: 'png' | 'jpeg' | 'svg') => {
  if (qrCode) qrCode.download({ name: 'open-qr-code', extension: format })
  isDownloadDropdownOpen.value = false
}

const resetToDefault = () => {
  if (confirm('¿Estás seguro de que quieres restablecer todo a los valores de fábrica?')) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.location.reload(); // Recarga para volver al estado inicial definido en los refs
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col overflow-x-hidden">
    
    <header class="bg-slate-800/50 backdrop-blur border-b border-slate-700/50 p-4 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">QR</div>
          <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Open QR Customizer
          </h1>
        </div>
        <span class="text-xs font-mono px-2.5 py-1 bg-slate-700/60 text-slate-400 rounded-full border border-slate-600/40">
          v1.2.7-stable
        </span>
      </div>
    </header>

    <main class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
      
      <section class="lg:col-span-7 space-y-6">
        
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-xl">
          <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span class="text-blue-400">1.</span> Contenido del QR
          </h2>
          <input v-model="qrText" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition" placeholder="https://tu-sitio-web.com" />
        </div>

        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-xl space-y-6 relative">
          <h2 class="text-lg font-semibold text-white flex items-center gap-2">
            <span class="text-blue-400">2.</span> Cuerpo y Módulos Base
          </h2>
          
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Forma de los Módulos</label>
            <div class="relative">
              <button @click="isDropdownOpen = !isDropdownOpen" type="button" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between text-left cursor-pointer">
                <div class="flex items-center gap-3">
                  <div class="w-4 h-4 bg-blue-500" :class="selectedDotType.shapeClass"></div>
                  <span>{{ selectedDotType.name }}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div v-if="isDropdownOpen" class="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-700/40">
                <button v-for="op in dotOptions" :key="op.id" @click="selectedDotType = op; isDropdownOpen = false" class="w-full px-4 py-3 text-sm flex items-center gap-3 hover:bg-slate-800 text-left cursor-pointer">
                  <div class="w-4 h-4 bg-slate-500" :class="op.shapeClass"></div>
                  <span>{{ op.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between border-b border-slate-700/40 pb-2">
              <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Color del Cuerpo</label>
              <div class="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                <button @click="qrColorType = 'single'" :class="qrColorType === 'single' ? 'bg-blue-600 text-white':'text-slate-400'" class="text-[11px] font-semibold px-2 py-1 rounded-md transition cursor-pointer">Sólido</button>
                <button @click="qrColorType = 'gradient'" :class="qrColorType === 'gradient' ? 'bg-blue-600 text-white':'text-slate-400'" class="text-[11px] font-semibold px-2 py-1 rounded-md transition cursor-pointer">Degradado</button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5 relative">
                <span class="text-[11px] text-slate-400 font-medium">{{ qrColorType === 'gradient' ? 'Color Inicial':'Color Único' }}</span>
                <div class="flex gap-2">
                  <button @click="toggleHslPanel('qr')" :style="{ backgroundColor: qrColor }" class="w-10 h-10 rounded-xl border border-slate-700 relative overflow-hidden cursor-pointer flex items-center justify-center"><span class="text-[9px] text-white bg-black/40 px-1 py-0.5 rounded font-bold">MIX</span></button>
                  <input v-model="qrColor" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-xl text-center text-xs font-mono uppercase text-white" maxlength="7" />
                </div>
                
                <div v-if="activeHslPanel === 'qr'" class="absolute left-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[260px] shadow-2xl">
                  <div class="text-xs font-bold text-blue-400 border-b border-slate-800 pb-1 flex justify-between"><span>Ajuste HSL (Cuerpo 1)</span><button @click="activeHslPanel = null" class="text-slate-500 hover:text-white font-bold">X</button></div>
                  <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Matiz (H)</span><span class="font-mono">{{ hslStates.qr.h }}°</span></div><input v-model.number="hslStates.qr.h" @input="updateHexFromHsl('qr')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
                  <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Saturación (S)</span><span class="font-mono">{{ hslStates.qr.s }}%</span></div><input v-model.number="hslStates.qr.s" @input="updateHexFromHsl('qr')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.qr.h}, 100%, 50%))` }" /></div>
                  <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Luminosidad (L)</span><span class="font-mono">{{ hslStates.qr.l }}%</span></div><input v-model.number="hslStates.qr.l" @input="updateHexFromHsl('qr')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
                </div>
              </div>

              <div v-if="qrColorType === 'gradient'" class="space-y-1.5 relative">
                <span class="text-[11px] text-slate-400 font-medium">Color Secundario</span>
                <div class="flex gap-2">
                  <button @click="toggleHslPanel('qr2')" :style="{ backgroundColor: qrColor2 }" class="w-10 h-10 rounded-xl border border-slate-700 relative overflow-hidden cursor-pointer flex items-center justify-center"><span class="text-[9px] text-white bg-black/40 px-1 py-0.5 rounded font-bold">MIX</span></button>
                  <input v-model="qrColor2" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-xl text-center text-xs font-mono uppercase text-white" maxlength="7" />
                </div>
                
                <div v-if="activeHslPanel === 'qr2'" class="absolute right-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[260px] shadow-2xl">
                  <div class="text-xs font-bold text-blue-400 border-b border-slate-800 pb-1 flex justify-between"><span>Ajuste HSL (Cuerpo 2)</span><button @click="activeHslPanel = null" class="text-slate-500 hover:text-white font-bold">X</button></div>
                  <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Matiz (H)</span><span class="font-mono">{{ hslStates.qr2.h }}°</span></div><input v-model.number="hslStates.qr2.h" @input="updateHexFromHsl('qr2')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
                  <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Saturación (S)</span><span class="font-mono">{{ hslStates.qr2.s }}%</span></div><input v-model.number="hslStates.qr2.s" @input="updateHexFromHsl('qr2')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.qr2.h}, 100%, 50%))` }" /></div>
                  <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Luminosidad (L)</span><span class="font-mono">{{ hslStates.qr2.l }}%</span></div><input v-model.number="hslStates.qr2.l" @input="updateHexFromHsl('qr2')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
                </div>
              </div>
            </div>

            <div v-if="qrColorType === 'gradient'" class="pt-2">
              <div class="flex justify-between text-[11px] text-slate-400 font-medium mb-1"><span>Ángulo del Degradado</span><span>{{ qrGradientRotation }}°</span></div>
              <input v-model.number="qrGradientRotation" type="range" min="0" max="360" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>

          <div class="border-t border-slate-700/40 pt-4 relative">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Color de Fondo General</label>
            <div class="flex gap-3 max-w-xs">
              <button @click="toggleHslPanel('bg')" :style="{ backgroundColor: bgColor }" class="w-10 h-10 rounded-xl border border-slate-700 relative overflow-hidden cursor-pointer flex items-center justify-center"><span class="text-[9px] text-black bg-white/70 px-1 py-0.5 rounded font-bold">MIX</span></button>
              <input v-model="bgColor" type="text" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono uppercase w-32 text-center text-white" maxlength="7" />
            </div>
            
            <div v-if="activeHslPanel === 'bg'" class="absolute left-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[260px] shadow-2xl">
              <div class="text-xs font-bold text-blue-400 border-b border-slate-800 pb-1 flex justify-between"><span>Ajuste HSL (Fondo)</span><button @click="activeHslPanel = null" class="text-slate-500 hover:text-white font-bold">X</button></div>
              <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Matiz (H)</span><span class="font-mono">{{ hslStates.bg.h }}°</span></div><input v-model.number="hslStates.bg.h" @input="updateHexFromHsl('bg')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
              <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Saturación (S)</span><span class="font-mono">{{ hslStates.bg.s }}%</span></div><input v-model.number="hslStates.bg.s" @input="updateHexFromHsl('bg')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.bg.h}, 100%, 50%))` }" /></div>
              <div class="space-y-1"><div class="flex justify-between text-[11px] text-slate-300"><span>Luminosidad (L)</span><span class="font-mono">{{ hslStates.bg.l }}%</span></div><input v-model.number="hslStates.bg.l" @input="updateHexFromHsl('bg')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><span>Margen del Código</span><span>{{ qrMargin }}px</span></div>
            <input v-model.number="qrMargin" type="range" min="0" max="40" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>

        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-xl space-y-6">
          <div class="border-b border-slate-700/60 pb-3">
            <h2 class="text-lg font-semibold text-white flex items-center gap-2">
              <span class="text-indigo-400">3.</span> Personalización de Patrones de Localización
            </h2>
          </div>

          <div class="space-y-4 border-b border-slate-700/30 pb-4 relative">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <label class="text-xs font-bold text-slate-300 uppercase tracking-wide">A. Marcos de los Ojos Externos</label>
              <div class="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700 self-start">
                <button @click="eyeFrameColorType = 'single'" :class="eyeFrameColorType === 'single'?'bg-indigo-600 text-white':'text-slate-400'" class="text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer">Sólido</button>
                <button @click="eyeFrameColorType = 'gradient'" :class="eyeFrameColorType === 'gradient'?'bg-indigo-600 text-white':'text-slate-400'" class="text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer">Degradado</button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span class="text-[11px] text-slate-400 block mb-1">Geometría del Marco</span>
                <button @click="isEyeFrameDropdownOpen = !isEyeFrameDropdownOpen" type="button" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-left cursor-pointer">
                  <span>{{ selectedEyeFrameType.name }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div v-if="isEyeFrameDropdownOpen" class="absolute bg-slate-900 border border-slate-700 rounded-xl mt-1 z-50 overflow-hidden divide-y divide-slate-700/40 w-[240px]">
                  <button v-for="op in eyeFrameOptions" :key="op.id" @click="selectedEyeFrameType = op; isEyeFrameDropdownOpen = false" class="w-full px-3 py-2 text-xs text-left hover:bg-slate-800 cursor-pointer block">{{ op.name }}</button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 relative">
                <div>
                  <span class="text-[11px] text-slate-400 block mb-1">Color 1</span>
                  <div class="flex gap-1.5">
                    <button @click="toggleHslPanel('ef')" :style="{ backgroundColor: eyeFrameColor }" class="w-8 h-8 rounded-lg border border-slate-700 flex-shrink-0 cursor-pointer flex items-center justify-center"><span class="text-[8px] text-white bg-black/40 px-1 rounded font-bold">MIX</span></button>
                    <input v-model="eyeFrameColor" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono text-center uppercase text-white" maxlength="7" />
                  </div>
                  <div v-if="activeHslPanel === 'ef'" class="absolute top-full left-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[240px] shadow-2xl">
                    <div class="text-[11px] font-bold text-indigo-400 border-b border-slate-800 pb-1 flex justify-between"><span>Marco HSL 1</span><button @click="activeHslPanel = null" class="text-slate-500 font-bold">X</button></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>H</span><span>{{ hslStates.ef.h }}°</span></div><input v-model.number="hslStates.ef.h" @input="updateHexFromHsl('ef')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>S</span><span>{{ hslStates.ef.s }}%</span></div><input v-model.number="hslStates.ef.s" @input="updateHexFromHsl('ef')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.ef.h}, 100%, 50%))` }" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>L</span><span>{{ hslStates.ef.l }}%</span></div><input v-model.number="hslStates.ef.l" @input="updateHexFromHsl('ef')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
                  </div>
                </div>

                <div v-if="eyeFrameColorType === 'gradient'">
                  <span class="text-[11px] text-slate-400 block mb-1">Color 2</span>
                  <div class="flex gap-1.5">
                    <button @click="toggleHslPanel('ef2')" :style="{ backgroundColor: eyeFrameColor2 }" class="w-8 h-8 rounded-lg border border-slate-700 flex-shrink-0 cursor-pointer flex items-center justify-center"><span class="text-[8px] text-white bg-black/40 px-1 rounded font-bold">MIX</span></button>
                    <input v-model="eyeFrameColor2" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono text-center uppercase text-white" maxlength="7" />
                  </div>
                  <div v-if="activeHslPanel === 'ef2'" class="absolute top-full right-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[240px] shadow-2xl">
                    <div class="text-[11px] font-bold text-indigo-400 border-b border-slate-800 pb-1 flex justify-between"><span>Marco HSL 2</span><button @click="activeHslPanel = null" class="text-slate-500 font-bold">X</button></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>H</span><span>{{ hslStates.ef2.h }}°</span></div><input v-model.number="hslStates.ef2.h" @input="updateHexFromHsl('ef2')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>S</span><span>{{ hslStates.ef2.s }}%</span></div><input v-model.number="hslStates.ef2.s" @input="updateHexFromHsl('ef2')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.ef2.h}, 100%, 50%))` }" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>L</span><span>{{ hslStates.ef2.l }}%</span></div><input v-model.number="hslStates.ef2.l" @input="updateHexFromHsl('ef2')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="eyeFrameColorType === 'gradient'" class="flex justify-between items-center text-[10px] text-slate-400">
              <span>Giro del Marco: {{ eyeFrameRotation }}°</span>
              <input v-model.number="eyeFrameRotation" type="range" min="0" max="360" class="w-1/2 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>
          </div>

          <div class="space-y-4 relative">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <label class="text-xs font-bold text-slate-300 uppercase tracking-wide">B. Pupilas Internas (Centros)</label>
              <div class="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700 self-start">
                <button @click="eyeDotColorType = 'single'" :class="eyeDotColorType === 'single'?'bg-indigo-600 text-white':'text-slate-400'" class="text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer">Sólido</button>
                <button @click="eyeDotColorType = 'gradient'" :class="eyeDotColorType === 'gradient'?'bg-indigo-600 text-white':'text-slate-400'" class="text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer">Degradado</button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span class="text-[11px] text-slate-400 block mb-1">Geometría de la Pupila</span>
                <button @click="isEyeDotDropdownOpen = !isEyeDotDropdownOpen" type="button" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-left cursor-pointer">
                  <span>{{ selectedEyeDotType.name }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div v-if="isEyeDotDropdownOpen" class="absolute bg-slate-900 border border-slate-700 rounded-xl mt-1 z-50 overflow-hidden divide-y divide-slate-700/40 w-[240px]">
                  <button v-for="op in eyeDotOptions" :key="op.id" @click="selectedEyeDotType = op; isEyeDotDropdownOpen = false" class="w-full px-3 py-2 text-xs text-left hover:bg-slate-800 cursor-pointer block">{{ op.name }}</button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 relative">
                <div>
                  <span class="text-[11px] text-slate-400 block mb-1">Color 1</span>
                  <div class="flex gap-1.5">
                    <button @click="toggleHslPanel('ed')" :style="{ backgroundColor: eyeDotColor }" class="w-8 h-8 rounded-lg border border-slate-700 flex-shrink-0 cursor-pointer flex items-center justify-center"><span class="text-[8px] text-white bg-black/40 px-1 rounded font-bold">MIX</span></button>
                    <input v-model="eyeDotColor" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono text-center uppercase text-white" maxlength="7" />
                  </div>
                  <div v-if="activeHslPanel === 'ed'" class="absolute top-full left-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[240px] shadow-2xl">
                    <div class="text-[11px] font-bold text-indigo-400 border-b border-slate-800 pb-1 flex justify-between"><span>Pupila HSL 1</span><button @click="activeHslPanel = null" class="text-slate-500 font-bold">X</button></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>H</span><span>{{ hslStates.ed.h }}°</span></div><input v-model.number="hslStates.ed.h" @input="updateHexFromHsl('ed')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>S</span><span>{{ hslStates.ed.s }}%</span></div><input v-model.number="hslStates.ed.s" @input="updateHexFromHsl('ed')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.ed.h}, 100%, 50%))` }" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>L</span><span>{{ hslStates.ed.l }}%</span></div><input v-model.number="hslStates.ed.l" @input="updateHexFromHsl('ed')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
                  </div>
                </div>

                <div v-if="eyeDotColorType === 'gradient'">
                  <span class="text-[11px] text-slate-400 block mb-1">Color 2</span>
                  <div class="flex gap-1.5">
                    <button @click="toggleHslPanel('ed2')" :style="{ backgroundColor: eyeDotColor2 }" class="w-8 h-8 rounded-lg border border-slate-700 flex-shrink-0 cursor-pointer flex items-center justify-center"><span class="text-[8px] text-white bg-black/40 px-1 rounded font-bold">MIX</span></button>
                    <input v-model="eyeDotColor2" type="text" class="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono text-center uppercase text-white" maxlength="7" />
                  </div>
                  <div v-if="activeHslPanel === 'ed2'" class="absolute top-full right-0 mt-2 bg-slate-950 border border-slate-600 p-4 rounded-xl z-[100] space-y-3 w-[240px] shadow-2xl">
                    <div class="text-[11px] font-bold text-indigo-400 border-b border-slate-800 pb-1 flex justify-between"><span>Pupila HSL 2</span><button @click="activeHslPanel = null" class="text-slate-500 font-bold">X</button></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>H</span><span>{{ hslStates.ed2.h }}°</span></div><input v-model.number="hslStates.ed2.h" @input="updateHexFromHsl('ed2')" type="range" min="0" max="360" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>S</span><span>{{ hslStates.ed2.s }}%</span></div><input v-model.number="hslStates.ed2.s" @input="updateHexFromHsl('ed2')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" :style="{ background: `linear-gradient(to right, #808080, hsl(${hslStates.ed2.h}, 100%, 50%))` }" /></div>
                    <div class="space-y-1"><div class="flex justify-between text-[10px] text-slate-300"><span>L</span><span>{{ hslStates.ed2.l }}%</span></div><input v-model.number="hslStates.ed2.l" @input="updateHexFromHsl('ed2')" type="range" min="0" max="100" class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500" style="background: linear-gradient(to right, #000000, #808080, #ffffff)" /></div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="eyeDotColorType === 'gradient'" class="flex justify-between items-center text-[10px] text-slate-400">
              <span>Giro de la Pupila: {{ eyeDotRotation }}°</span>
              <input v-model.number="eyeDotRotation" type="range" min="0" max="360" class="w-1/2 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>
          </div>
        </div>

        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-xl space-y-4">
          <h2 class="text-lg font-semibold text-white flex items-center gap-2">
            <span class="text-blue-400">4.</span> Logotipo de Marca
          </h2>
          
          <div v-if="!logoUrl" class="border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl p-6 text-center cursor-pointer bg-slate-900/40 group">
            <input @change="handleLogoUpload" type="file" accept="image/*" class="hidden" id="logo-file" />
            <label for="logo-file" class="cursor-pointer flex flex-col items-center gap-2 text-slate-400 text-sm">
              <span class="font-medium group-hover:text-slate-200">Haz clic para cargar tu logotipo</span>
              <span class="text-xs text-slate-500">Soporta PNG, JPG o SVG (Recomendado transparente)</span>
            </label>
          </div>

          <div v-else class="space-y-4">
            <div class="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center border overflow-hidden">
                  <img :src="logoUrl" alt="Logo preview" class="max-w-full max-h-full object-contain" />
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-200">Logotipo incrustado</p>
                  <p class="text-xs text-slate-500">Módulos colapsados para evitar colisiones.</p>
                </div>
              </div>
              <button @click="logoUrl = null" type="button" class="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold cursor-pointer border border-rose-500/20">Remover</button>
            </div>

            <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
              <div class="flex justify-between items-center text-xs">
                <span class="font-semibold text-slate-400 uppercase tracking-wider">Escala del Logo</span>
                <span :class="logoSize > 0.32 ? 'text-amber-400 font-bold':'text-blue-400 font-mono'">{{ Math.round(logoSize * 100) }}% del área</span>
              </div>
              <input v-model.number="logoSize" type="range" min="0.15" max="0.35" step="0.01" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        </div>

      </section>

      <section class="lg:col-span-5">
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-xl text-center lg:sticky lg:top-24 space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white flex items-center gap-2">
              <span class="text-indigo-400">5.</span> Vista Previa
            </h2>
            <span class="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded flex items-center gap-1">
              ● Autoguardado Activo
            </span>
          </div>
          
          <div class="bg-white p-5 rounded-2xl inline-block shadow-inner mx-auto border border-slate-200 overflow-hidden">
            <div ref="qrContainer" class="flex items-center justify-center min-w-[240px] min-h-[240px]"></div>
          </div>

          <div class="space-y-3 pt-2">
            <div class="grid grid-cols-2 gap-3">
              <button @click="saveConfiguration" type="button" class="px-3 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                <span>Exportar JSON</span>
              </button>

              <input type="file" id="import-config-file" accept=".json" @change="loadConfiguration" class="hidden" />
              <button @click="triggerConfigFileUpload" type="button" class="px-3 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span>Importar JSON</span>
              </button>
            </div>
            
            <div class="relative">
              <button @click="isDownloadDropdownOpen = !isDownloadDropdownOpen" type="button" class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg transition flex items-center justify-between cursor-pointer">
                <span class="mx-auto pl-2">Descargar Archivo Final</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>

              <button @click="resetToDefault" type="button" class="w-full mt-3 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span>Reiniciar Valores</span>
              </button>

              <div v-if="isDownloadDropdownOpen" class="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-700/40">
                <button @click="downloadAs('png')" class="w-full px-4 py-2.5 text-xs text-left text-slate-300 hover:bg-slate-800 transition flex items-center justify-between cursor-pointer"><span>Imagen de Alta Densidad PNG</span><span class="text-[9px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">.png</span></button>
                <button @click="downloadAs('jpeg')" class="w-full px-4 py-2.5 text-xs text-left text-slate-300 hover:bg-slate-800 transition flex items-center justify-between cursor-pointer"><span>Imagen Comprimida JPEG</span><span class="text-[9px] font-mono px-1.5 py-0.5 bg-amber-950 text-amber-400 rounded">.jpg</span></button>
                <button @click="downloadAs('svg')" class="w-full px-4 py-2.5 text-xs text-left text-slate-300 hover:bg-slate-800 transition flex items-center justify-between cursor-pointer"><span>Vectorial Escalable SVG (Imprenta)</span><span class="text-[9px] font-mono px-1.5 py-0.5 bg-blue-950 text-blue-400 rounded">.svg</span></button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>

    <footer class="bg-slate-950/40 border-t border-slate-800/60 p-4 text-center text-xs text-slate-500 font-mono mt-auto">
      Open QR Customizer • Vue 3 & Tailwind Architecture • v1.2.7
    </footer>
  </div>
</template>