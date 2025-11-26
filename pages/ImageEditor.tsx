import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Wand2, Download, X, RefreshCw, AlertCircle, Camera } from 'lucide-react';
import { editImageWithGemini } from '../services/geminiService';

const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("Por favor envie um arquivo de imagem válido.");
      return;
    }
    
    // Check file size (limit to ~4MB to be safe with base64)
    if (file.size > 4 * 1024 * 1024) {
        setError("A imagem deve ter no máximo 4MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setGeneratedImage(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
      if (!originalImage || !prompt.trim()) return;
      
      setLoading(true);
      setError(null);
      
      try {
          const result = await editImageWithGemini(originalImage, prompt);
          if (result) {
              setGeneratedImage(result);
          } else {
              setError("Não foi possível gerar a imagem. Tente um prompt diferente.");
          }
      } catch (err) {
          setError("Erro ao comunicar com a IA.");
      } finally {
          setLoading(false);
      }
  };

  const handleDownload = () => {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `editado-conferex-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center">
            <Wand2 className="mr-3 text-brand-600" size={32} />
            Editor de Imagens IA
        </h2>
        <p className="text-gray-500 mt-1">Edite fotos de avarias, produtos ou documentos usando instruções de texto.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          
          {/* Left Column: Input */}
          <div className="flex flex-col space-y-6">
              
              {/* Image Uploader */}
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-700">Imagem Original</h3>
                      {originalImage && (
                          <button onClick={() => {setOriginalImage(null); setGeneratedImage(null);}} className="text-xs text-red-500 hover:text-red-700 font-medium">
                              Remover
                          </button>
                      )}
                  </div>
                  
                  <div className="flex-1 relative bg-gray-100 flex items-center justify-center p-4">
                      {originalImage ? (
                          <img src={originalImage} alt="Original" className="max-w-full max-h-[400px] object-contain rounded-lg shadow-md" />
                      ) : (
                        <div 
                            className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center p-8 transition-colors ${
                                dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400'
                            }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleChange} />
                            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                <Upload className="text-gray-400" size={32} />
                            </div>
                            <p className="text-gray-600 font-medium mb-1">Clique ou arraste uma imagem</p>
                            <p className="text-xs text-gray-400">JPG, PNG (Max 4MB)</p>
                        </div>
                      )}
                  </div>
              </div>

              {/* Prompt Input */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Instrução de Edição</label>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ex: Adicionar filtro retro, remover fundo, destacar a caixa amassada..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                      />
                      <button 
                        onClick={handleGenerate}
                        disabled={!originalImage || !prompt.trim() || loading}
                        className={`px-6 py-2 rounded-lg font-bold text-white flex items-center space-x-2 transition-all ${
                            !originalImage || !prompt.trim() || loading 
                            ? 'bg-gray-300 cursor-not-allowed' 
                            : 'bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/30'
                        }`}
                      >
                          {loading ? <RefreshCw className="animate-spin" size={20}/> : <Wand2 size={20}/>}
                          <span className="hidden md:inline">Gerar</span>
                      </button>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 pt-1">Sugestões:</span>
                      {["Melhorar iluminação", "Remover fundo", "Destacar danos em vermelho", "Transformar em desenho técnico"].map(s => (
                          <button 
                            key={s} 
                            onClick={() => setPrompt(s)}
                            className="text-xs bg-gray-100 hover:bg-brand-50 hover:text-brand-600 text-gray-600 px-3 py-1 rounded-full border border-gray-200 transition-colors whitespace-nowrap"
                          >
                              {s}
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          {/* Right Column: Result */}
          <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 flex items-center">
                      <ImageIcon className="mr-2 text-brand-600" size={18} /> 
                      Resultado IA
                  </h3>
                  {generatedImage && (
                      <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center space-x-1">
                          <Download size={14} /> <span>Baixar</span>
                      </button>
                  )}
              </div>
              
              <div className="flex-1 bg-gray-900/5 relative flex items-center justify-center p-4">
                  {loading ? (
                      <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600 mb-4"></div>
                          <p className="text-gray-500 font-medium">Processando imagem...</p>
                          <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos.</p>
                      </div>
                  ) : error ? (
                      <div className="text-center max-w-xs">
                          <div className="bg-red-100 p-3 rounded-full inline-block mb-3">
                              <AlertCircle className="text-red-500" size={32} />
                          </div>
                          <p className="text-red-600 font-medium">{error}</p>
                      </div>
                  ) : generatedImage ? (
                      <div className="relative group w-full h-full flex items-center justify-center">
                          <img src={generatedImage} alt="Generated" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                      </div>
                  ) : (
                      <div className="text-center text-gray-400">
                          <Wand2 className="mx-auto mb-3 opacity-20" size={64} />
                          <p>O resultado da edição aparecerá aqui.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default ImageEditor;