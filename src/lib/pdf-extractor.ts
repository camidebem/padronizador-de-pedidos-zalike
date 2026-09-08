import * as pdfjsLib from 'pdfjs-dist'

// Set worker source for browser pdfjs-dist
if (typeof window !== 'undefined' && 'Worker' in window) {
  // Use worker from unpkg/cdnjs compatible with the installed pdfjs-dist version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

export interface PdfPageText {
  pageNumber: number
  text: string
  hasLowText: boolean
}

export interface PdfRawExtraction {
  pages: PdfPageText[]
  fullText: string
  isScannedOrOcrNeeded: boolean
}

/**
 * Extracts raw text from each page of a digital PDF using pdfjs-dist.
 * Flags whether the document appears to be scanned or image-only.
 */
export async function extractPdfText(file: File): Promise<PdfRawExtraction> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  })

  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  const pages: PdfPageText[] = []
  let totalCharacters = 0

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Reconstruct page text keeping sensible line spacing
    const strings: string[] = []
    let lastY: number | null = null

    for (const item of textContent.items) {
      if ('str' in item) {
        const textItem = item as { str: string; transform: number[] }
        const currentY = textItem.transform[5]
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          strings.push('\n')
        } else if (strings.length > 0 && !strings[strings.length - 1].endsWith(' ') && !strings[strings.length - 1].endsWith('\n')) {
          strings.push(' ')
        }
        strings.push(textItem.str)
        lastY = currentY
      }
    }

    const pageText = strings.join('').trim()
    const charCount = pageText.replace(/\s+/g, '').length
    totalCharacters += charCount

    pages.push({
      pageNumber: pageNum,
      text: pageText,
      hasLowText: charCount < 40,
    })
  }

  // If average characters per page is very low (< 30 chars), the PDF is likely scanned
  const avgChars = pages.length > 0 ? totalCharacters / pages.length : 0
  const isScannedOrOcrNeeded = avgChars < 30

  return {
    pages,
    fullText: pages.map((p) => `--- PÁGINA ${p.pageNumber} ---\n${p.text}`).join('\n\n'),
    isScannedOrOcrNeeded,
  }
}

/**
 * Lazy OCR fallback using Tesseract.js.
 * Only loaded dynamically when the PDF has minimal or no digital text.
 */
export async function performOcrFallback(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  try {
    // Dynamic import to keep bundle small
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('por', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress?.(Math.round(m.progress * 100))
        }
      },
    })

    // Render first page as canvas via pdfjs
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      await worker.terminate()
      throw new Error('Não foi possível inicializar renderizador de imagem.')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page.render({ canvasContext: ctx as any, viewport }) as any).promise

    const ret = await worker.recognize(canvas)
    await worker.terminate()

    return ret.data.text || ''
  } catch (ocrErr) {
    console.warn('[ocr] Falha no fallback Tesseract:', ocrErr)
    return ''
  }
}
