import { extractFromExcel } from './excel-extractor'
import { extractPdfText, performOcrFallback } from './pdf-extractor'
import { normalizeTextWithAi } from './ai-normalizer'
import { parseOrdersClientSide } from './client-order-parser'
import { ExtractedOrder, ExtractionResult } from './extractor-types'

export type ExtractionProgressCallback = (status: string, percent?: number) => void

/**
 * Full Pipeline for order extraction:
 * 1. Client-side extraction (XLSX or PDF.js + Tesseract OCR fallback).
 * 2. Per-page / multi-order separation.
 * 3. AI normalization via Skip Cloud Native Agent (with client-side regex safety net).
 */
export async function processFilePipeline(
  file: File,
  onProgress?: ExtractionProgressCallback,
): Promise<ExtractionResult> {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf'

  if (isExcel) {
    onProgress?.('Lendo dados da planilha Excel...')
    const order = await extractFromExcel(file)
    return {
      fileName: file.name,
      fileType: 'excel',
      orders: [order],
      totalOrders: 1,
      isOcr: false,
    }
  }

  if (isPdf) {
    onProgress?.('Lendo páginas do PDF...')
    const pdfData = await extractPdfText(file)

    let isOcr = false
    let extractedText = pdfData.fullText

    // If PDF has virtually no digital text (scanned document)
    if (pdfData.isScannedOrOcrNeeded || pdfData.pages.every((p) => p.hasLowText)) {
      onProgress?.('PDF escaneado detectado. Iniciando OCR...', 20)
      isOcr = true
      const ocrText = await performOcrFallback(file, (p) => {
        onProgress?.(`Reconhecendo texto via OCR... (${p}%)`, p)
      })

      if (ocrText && ocrText.trim().length > 30) {
        extractedText = ocrText
      }
    }

    onProgress?.('Identificando pedidos e separando páginas...')

    // Check if the document has multiple pages.
    // If multiple pages, process page by page or block by block to isolate each order.
    let finalOrders: ExtractedOrder[] = []

    if (pdfData.pages.length > 1 && !isOcr) {
      // Process each page as an independent candidate order (e.g. Mundo dos Cosméticos 55 pages = 55 orders)
      const pageOrders: ExtractedOrder[] = []

      for (let i = 0; i < pdfData.pages.length; i++) {
        const page = pdfData.pages[i]
        onProgress?.(`Processando página ${i + 1} de ${pdfData.pages.length}...`)

        // Attempt client-side regex parsing for this page first
        const clientParsed = parseOrdersClientSide(page.text, false)
        if (clientParsed.length > 0) {
          pageOrders.push(...clientParsed)
        } else {
          // If regex found nothing but page has text, try AI on this page
          try {
            const aiParsed = await normalizeTextWithAi(page.text, false)
            if (aiParsed.length > 0) {
              pageOrders.push(...aiParsed)
            } else {
              // Fallback manual order with raw text
              pageOrders.push(createEmptyOrderWithRawText(page.text, `Página ${i + 1}`))
            }
          } catch {
            pageOrders.push(createEmptyOrderWithRawText(page.text, `Página ${i + 1}`))
          }
        }
      }

      finalOrders = pageOrders
    } else {
      // Single page PDF or OCR text: try AI first, fallback to client-side regex
      onProgress?.('Normalizando dados com IA Zalike...')
      try {
        const aiOrders = await normalizeTextWithAi(extractedText, isOcr)
        if (aiOrders.length > 0) {
          finalOrders = aiOrders
        } else {
          // Client-side fallback
          finalOrders = parseOrdersClientSide(extractedText, isOcr)
        }
      } catch (aiErr) {
        console.warn('[pipeline] Falha na IA, utilizando parser cliente:', aiErr)
        finalOrders = parseOrdersClientSide(extractedText, isOcr)
      }

      // If still empty, supply a manual fallback order with raw text
      if (finalOrders.length === 0) {
        finalOrders = [createEmptyOrderWithRawText(extractedText, 'Pedido 1')]
      }
    }

    return {
      fileName: file.name,
      fileType: 'pdf',
      orders: finalOrders,
      totalOrders: finalOrders.length,
      isOcr,
      rawTextPreview: extractedText.slice(0, 500),
      warning: isOcr ? 'Atenção: arquivo processado via OCR (baixa confiança). Confira os dados.' : undefined,
    }
  }

  throw new Error('Formato de arquivo não suportado.')
}

function createEmptyOrderWithRawText(rawText: string, orderNumber: string): ExtractedOrder {
  return {
    id: crypto.randomUUID(),
    orderNumber,
    confidence: 'manual',
    rawText,
    warning: 'Não foi possível extrair os itens automaticamente. Preencha manualmente ou confira o texto bruto.',
    header: {
      cnpj: '',
      repCode: '',
      paymentCode: '',
      paymentDesc: '',
      obs: 'Extração manual necessária',
      nature: 'Venda',
    },
    items: [],
  }
}
