"use client";

import React, { useState, useEffect } from 'react';
import Head from 'next/head';

// Declara as bibliotecas no escopo global para o TypeScript
declare global {
  interface Window {
    Papa: any;
    jspdf: any;
    bwipjs: any;
    JSZip: any;
  }
}

// Interface simplificada conforme sua solicitação
interface CsvRow {
  MODELO: string;
  DUN: string;
  QTD_ETIQUETAS?: string;
}

export default function EtiquetasMasterPage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [timestamp, setTimestamp] = useState(0);

  useEffect(() => {
    setTimestamp(new Date().getTime());
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/bwip-js@4.1.0/dist/bwip-js.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
    ]).then(() => {
      setScriptsLoaded(true);
    }).catch(err => {
      console.error("Falha ao carregar scripts:", err);
      setError("Erro ao carregar dependências. Verifique sua conexão.");
    });
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Por favor, selecione um arquivo .csv válido.');
        return;
      }
      
      setFileName(file.name);
      setError('');
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";",
        complete: (results: any) => {
          const requiredColumns = ['MODELO', 'DUN'];
          const fileColumns = results.meta.fields || [];
          const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

          if (missingColumns.length > 0) {
            setError(`O CSV está sem as colunas obrigatórias: ${missingColumns.join(', ')}`);
            setCsvData([]);
            return;
          }
          setCsvData(results.data);
        },
        error: (err: any) => setError(`Erro no processamento: ${err.message}`)
      });
    }
  };

  const downloadTemplate = () => {
    const csvContent = "\uFEFFMODELO;DUN;QTD_ETIQUETAS\n" +
                       "AGT-SFT1;17898663996118;1";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_etiquetas_dun14.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = async () => {
    if (csvData.length === 0) return;
    setLoading(true);
    setError('');

    const zip = new window.JSZip();

    const generateBarcodeImage = (text: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        let cleanText = text.toString().trim().replace(/\s/g, ''); 
        const canvas = document.createElement('canvas');
        try {
          window.bwipjs.toCanvas(canvas, {
            bcid: 'code128', 
            text: cleanText,
            scale: 5,        
            height: 12,
            includetext: false, 
          });
          resolve(canvas.toDataURL("image/png"));
        } catch (e) { 
            reject(new Error(`Código "${cleanText}" inválido.`)); 
        }
      });
    };

    try {
      for (const row of csvData) {
        if (!row.MODELO || !row.DUN) continue;
        
        const doc = new window.jspdf.jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [100, 25], 
        });

        const quantity = parseInt(row.QTD_ETIQUETAS || '1', 10);
        const barcodeImage = await generateBarcodeImage(row.DUN);

        for (let i = 0; i < quantity; i++) {
          if (i > 0) doc.addPage();

          const pageW = 100;

          // 1. SKU / MODELO - Fonte reduzida para dar destaque ao código de barras
          doc.setTextColor(0, 0, 0);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(16);
          doc.text(row.MODELO, pageW / 2, 7, { align: 'center' });

          // 2. CÓDIGO DE BARRAS - Mais largo (80mm) para maior destaque
          doc.addImage(barcodeImage, 'PNG', 10, 8, 80, 10);

          // 3. NÚMERAL DUN-14 - Com espaçamento vertical (Y ajustado para 22)
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(12);
          const spacedDun = row.DUN.split('').join('  '); 
          doc.text(spacedDun, pageW / 2, 22, { align: 'center' });
        }

        const pdfBlob = doc.output('blob');
        const safeFileName = `${row.MODELO.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        zip.file(safeFileName, pdfBlob);
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = "etiquetas_dun14_agetherm.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (e: any) {
      setError(`Erro ao processar etiquetas: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <Head>
        <title>Agetherm - Gerador de Etiquetas DUN-14</title>
      </Head>

      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl border-t-8 border-[#FF8C00] overflow-hidden">
        
        <div className="p-6 text-center border-b border-gray-100">
          <div className="h-20 flex items-center justify-center mb-4">
            <img 
              src={`/logo.png?v=${timestamp}`} 
              alt="Agetherm Logo" 
              className="max-h-full" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x80?text=AGETHERM';
              }}
            />
          </div>
          <h1 className="text-2xl font-extrabold text-[#002B5B]">GERADOR DE ETIQUETAS DUN-14</h1>
        </div>

        <div className="p-8 space-y-8">
          
          {error && (
            <div className="p-4 bg-red-100 text-red-800 rounded-lg text-center font-bold border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block font-bold text-[#002B5B] text-xs uppercase mb-1">Faça o upload do arquivo CSV (BAIXE O MODELO)</label>
              <label className="flex items-center gap-3 cursor-pointer group border-2 border-dashed border-gray-200 p-6 rounded-lg hover:bg-gray-50 transition-all">
                <div className="bg-[#002B5B] text-white px-5 py-2 rounded font-bold text-xs group-hover:bg-[#001f42] transition-colors uppercase shadow-sm">
                  Escolher CSV
                </div>
                <span className="text-gray-600 text-sm font-semibold flex-1 truncate">
                  {fileName || "Nenhum arquivo selecionado"}
                </span>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={!scriptsLoaded}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={downloadTemplate}
                className="flex items-center justify-center gap-2 bg-gray-200 text-[#002B5B] py-4 rounded-lg font-bold text-xs hover:bg-gray-300 transition-colors uppercase"
              >
                Baixar Modelo CSV
              </button>

              <button 
                type="button"
                onClick={generatePDF}
                disabled={loading || csvData.length === 0 || !scriptsLoaded}
                className="bg-[#FF8C00] text-white py-4 rounded-lg font-bold text-sm hover:bg-[#e67e00] transition-colors disabled:bg-gray-300 shadow-md flex items-center justify-center gap-2 uppercase"
              >
                {loading ? "Gerando..." : "Gerar Etiquetas (100x25mm)"}
              </button>
            </div>
          </div>

          {!scriptsLoaded && (
             <p className="text-center text-xs text-gray-400 animate-pulse uppercase font-bold tracking-widest">
               Carregando bibliotecas do sistema...
             </p>
          )}

        </div>
      </div>
    </div>
  );
}