"use client";

import React, { useState, useEffect } from 'react';
import Head from 'next/head';

declare global {
  interface Window {
    Papa: any;
    jspdf: any;
    bwipjs: any;
    JSZip: any;
  }
}

interface CsvRow {
  ID: string;
  DESCRICAO: string;
  CAIXA: string;
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

  const totalSkus = csvData.length;
  const totalEtiquetas = csvData.reduce((acc, curr) => acc + parseInt(curr.QTD_ETIQUETAS || '1', 10), 0);

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
      setError("Erro ao carregar dependências.");
    });
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Selecione um arquivo .csv válido.');
        return;
      }
      setFileName(file.name);
      setError('');
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";",
        complete: (results: any) => {
          const requiredColumns = ['ID', 'DESCRICAO', 'CAIXA', 'DUN'];
          const fileColumns = results.meta.fields || [];
          const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));
          if (missingColumns.length > 0) {
            setError(`Colunas ausentes: ${missingColumns.join(', ')}`);
            setCsvData([]);
            return;
          }
          setCsvData(results.data);
        },
      });
    }
  };

  const formatHeaderText = (id: string, desc: string, caixa: string) => {
    const limit = 58; 
    const prefix = `(${id} - `;
    const suffix = `) CAIXA - ${caixa}`;
    if ((prefix + desc + suffix).length > limit) {
      const availableSpace = limit - prefix.length - suffix.length - 3;
      const truncatedDesc = desc.substring(0, Math.max(0, availableSpace)) + "...";
      return `${prefix}${truncatedDesc}${suffix}`;
    }
    return `${prefix}${desc}${suffix}`;
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
        } catch (e) { reject(e); }
      });
    };

    try {
      for (const row of csvData) {
        if (!row.ID || !row.DUN) continue;
        const doc = new window.jspdf.jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [100, 30], 
        });

        const quantity = parseInt(row.QTD_ETIQUETAS || '1', 10);
        const barcodeImage = await generateBarcodeImage(row.DUN);
        const headerText = formatHeaderText(row.ID, row.DESCRICAO.toUpperCase(), row.CAIXA);

        for (let i = 0; i < quantity; i++) {
          if (i > 0) doc.addPage();
          const pageW = 100;

          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
          doc.text(headerText, pageW / 2, 7, { align: 'center' });

          doc.addImage(barcodeImage, 'PNG', 5, 9.5, 90, 11);

          doc.setFontSize(18);
          doc.text(row.DUN, pageW / 2, 27, { align: 'center' });
        }

        const pdfBlob = doc.output('blob');
        zip.file(`${row.ID.replace(/[^a-z0-9]/gi, '_')}.pdf`, pdfBlob);
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipContent);
      link.download = "etiquetas_agetherm.zip";
      link.click();
    } catch (e: any) {
      setError(`Erro: ${e.message}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <Head><title>Agetherm - Gerador de Etiquetas DUN-14</title></Head>
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl border-t-8 border-[#FF8C00] overflow-hidden">
        <div className="p-6 text-center border-b border-gray-100">
          <div className="h-20 flex items-center justify-center mb-4">
            <img src={`/logo.png?v=${timestamp}`} alt="Agetherm Logo" className="max-h-full" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#002B5B]">GERADOR DE ETIQUETAS DUN-14</h1>
        </div>
        <div className="p-8 space-y-8">
          {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg text-center font-bold text-sm">{error}</div>}
          
          <div className="space-y-6">
            <label className="block group border-2 border-dashed border-gray-200 p-6 rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-[#002B5B] text-white px-5 py-2 rounded font-bold text-xs uppercase">Escolher CSV</div>
                <span className="text-gray-600 text-sm flex-1 truncate">{fileName || "Nenhum arquivo selecionado"}</span>
              </div>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={!scriptsLoaded} />
            </label>

            {/* Blocos de Quantidade movidos para baixo do upload */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 border p-4 rounded-xl text-center shadow-sm">
                <p className="text-[10px] uppercase font-bold text-gray-500">Total SKUs</p>
                <p className="text-2xl font-black text-[#002B5B]">{totalSkus}</p>
              </div>
              <div className="bg-gray-50 border p-4 rounded-xl text-center shadow-sm">
                <p className="text-[10px] uppercase font-bold text-gray-500">Total Etiquetas</p>
                <p className="text-2xl font-black text-[#FF8C00]">{totalEtiquetas}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => {
                const csv = "\uFEFFID;DESCRICAO;CAIXA;DUN;QTD_ETIQUETAS\nAGT-SFT1;MOTOR VENTILADOR;50;17898663996118;1";
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
                link.download = "modelo_etiquetas_dun-14.csv";
                link.click();
              }} className="bg-gray-200 text-[#002B5B] py-4 rounded-lg font-bold text-xs uppercase">Baixar Modelo CSV</button>
              <button onClick={generatePDF} disabled={loading || csvData.length === 0} className="bg-[#FF8C00] text-white py-4 rounded-lg font-bold text-sm uppercase shadow-md transition-all active:scale-95">{loading ? "Gerando..." : "Gerar Etiquetas (100x25mm)"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}