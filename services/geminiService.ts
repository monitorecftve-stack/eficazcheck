import { GoogleGenAI } from "@google/genai";
import { Order, ProductItem } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key is missing provided in process.env.API_KEY");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeDiscrepancies = async (order: Order): Promise<string> => {
  const client = getClient();
  if (!client) return "API Key not configured. Cannot generate AI analysis.";

  // Calculate discrepancies
  const discrepancies = order.items.filter(i => i.quantityScanned !== i.quantityRequested);
  
  if (discrepancies.length === 0) {
    return "Análise IA: Conferência perfeita. Nenhum erro detectado. Eficiência máxima atingida.";
  }

  const prompt = `
    Você é um analista de logística sênior. Analise o seguinte relatório de divergência de conferência de saída (picking/packing):
    
    Cliente: ${order.customerName}
    Pedido ID: ${order.id}
    Responsável Separação: ${order.sessionData?.separatorName}
    Responsável Conferência: ${order.sessionData?.conferenteName}
    
    Itens com Divergência:
    ${discrepancies.map(d => `- Produto: ${d.name} (SKU: ${d.sku}). Solicitado: ${d.quantityRequested}, Conferido: ${d.quantityScanned} (${d.quantityScanned > d.quantityRequested ? 'SOBRA' : 'FALTA'})`).join('\n')}
    
    Por favor, forneça um resumo executivo curto (máximo 3 parágrafos) em Português:
    1. Resumo dos erros.
    2. Possível causa raiz baseada nos padrões (ex: erro de contagem, troca de produto similar, erro sistêmico).
    3. Uma recomendação para o supervisor.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com o serviço de IA para análise.";
  }
};

export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string | null> => {
  const client = getClient();
  if (!client) {
      console.error("API Key missing");
      return null;
  }

  try {
    // Extract base64 data if it includes the header
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Standardizing on jpeg for upload
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    // Check parts for image data
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Image Edit Error:", error);
    return null;
  }
};