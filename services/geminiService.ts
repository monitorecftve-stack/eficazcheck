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