import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ChevronRight, Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import { reconcile } from './utils/reconciliationLogic';

const App = () => {
  const [bankData, setBankData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('matched');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (file, type) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      let parsedData = [];

      if (file.name.endsWith('.csv')) {
        Papa.parse(data, {
          header: true,
          complete: (results) => {
            parsedData = results.data;
            if (type === 'bank') setBankData({ name: file.name, data: parsedData });
            else setSalesData({ name: file.name, data: parsedData });
          }
        });
      } else {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (type === 'bank') setBankData({ name: file.name, data: parsedData });
        else setSalesData({ name: file.name, data: parsedData });
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const startReconciliation = () => {
    if (!bankData || !salesData) return;
    setIsProcessing(true);

    // Auto-detect columns (simple heuristic)
    const detectCols = (data) => {
      const keys = Object.keys(data[0] || {});
      return {
        amount: keys.find(k => k.toLowerCase().includes('monto') || k.toLowerCase().includes('valor') || k.toLowerCase().includes('pago')) || keys[0],
        date: keys.find(k => k.toLowerCase().includes('fecha')) || keys[1],
        ref: keys.find(k => k.toLowerCase().includes('ref') || k.toLowerCase().includes('doc') || k.toLowerCase().includes('obs')) || keys[2]
      };
    };

    const bankCols = detectCols(bankData.data);
    const salesCols = detectCols(salesData.data);

    const config = {
      bankAmountCol: bankCols.amount,
      bankDateCol: bankCols.date,
      bankRefCol: bankCols.ref,
      salesAmountCol: salesCols.amount,
      salesDateCol: salesCols.date,
      salesRefCol: salesCols.ref,
      toleranceAmount: 1, // $1 peso de diferencia
      toleranceDays: 3    // 3 días de diferencia
    };

    setTimeout(() => {
      const res = reconcile(bankData.data, salesData.data, config);
      setResults(res);
      setIsProcessing(false);
    }, 1500);
  };

  const reset = () => {
    setBankData(null);
    setSalesData(null);
    setResults(null);
  };

  return (
    <div className="container">
      <header className="header">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Conciliador Pro
        </motion.h1>
        <p className="text-dim">Automatiza el cuadre entre tu cuenta bancaria y tus ventas.</p>
      </header>

      {!results ? (
        <div className="grid">
          <FileCard
            title="Cartola Bancaria"
            data={bankData}
            onUpload={(file) => handleFileUpload(file, 'bank')}
            icon={<Upload size={40} />}
          />
          <FileCard
            title="Salida Ventas"
            data={salesData}
            onUpload={(file) => handleFileUpload(file, 'sales')}
            icon={<FileText size={40} />}
          />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2>Resultados de Conciliación</h2>
            <button className="btn" style={{ background: 'var(--error)' }} onClick={reset}>
              <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> Nueva Conciliación
            </button>
          </div>

          <div className="stat-grid">
            <StatItem label="Ventas Conciliadas" value={results.summary.matchedCount} color="var(--success)" />
            <StatItem label="Pendientes Banco" value={results.summary.bankPendingCount} color="var(--error)" />
            <StatItem label="Pendientes Ventas" value={results.summary.salesPendingCount} color="var(--warning)" />
          </div>

          <div className="tabs" style={{ marginTop: '3rem' }}>
            <div className={`tab ${activeTab === 'matched' ? 'active' : ''}`} onClick={() => setActiveTab('matched')}>
              Conciliados ({results.summary.matchedCount})
            </div>
            <div className={`tab ${activeTab === 'bank' ? 'active' : ''}`} onClick={() => setActiveTab('bank')}>
              Pendientes Banco ({results.summary.bankPendingCount})
            </div>
            <div className={`tab ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>
              Pendientes Ventas ({results.summary.salesPendingCount})
            </div>
          </div>

          <div className="table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'matched' && results.matched.map((m, i) => (
                  <tr key={i}>
                    <td>{m.sale.Fecha || m.sale.date || 'N/A'}</td>
                    <td>${Number(m.sale.Monto || m.sale.amount).toLocaleString()}</td>
                    <td>{m.sale.Referencia || m.sale.ref || '-'}</td>
                    <td><span className="badge badge-success">{m.type}</span></td>
                  </tr>
                ))}
                {activeTab === 'bank' && results.bankPending.map((b, i) => (
                  <tr key={i}>
                    <td>{b.Fecha || b.date || 'N/A'}</td>
                    <td>${Number(b.Monto || b.amount).toLocaleString()}</td>
                    <td>{b.Referencia || b.ref || '-'}</td>
                    <td><span className="badge badge-error">No en ventas</span></td>
                  </tr>
                ))}
                {activeTab === 'sales' && results.salesPending.map((s, i) => (
                  <tr key={i}>
                    <td>{s.Fecha || s.date || 'N/A'}</td>
                    <td>${Number(s.Monto || s.amount).toLocaleString()}</td>
                    <td>{s.Referencia || s.ref || '-'}</td>
                    <td><span className="badge badge-warning">No en banco</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {!results && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            className="btn"
            style={{ padding: '1rem 3rem', fontSize: '1.2rem' }}
            disabled={!bankData || !salesData || isProcessing}
            onClick={startReconciliation}
          >
            {isProcessing ? 'Procesando...' : 'Iniciar Conciliación'}
          </button>
        </div>
      )}
    </div>
  );
};

const FileCard = ({ title, data, onUpload, icon }) => (
  <div className="glass-card">
    <h3>{title}</h3>
    {!data ? (
      <div className="upload-zone" onClick={() => document.getElementById(title).click()}>
        <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{icon}</div>
        <p>Arrastra o haz clic para subir</p>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>CSV, XLSX, XLS</span>
        <input
          id={title}
          type="file"
          hidden
          onChange={(e) => onUpload(e.target.files[0])}
          accept=".csv,.xlsx,.xls"
        />
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}>
        <CheckCircle color="var(--success)" />
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{data.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{data.data.length} registros cargados</div>
        </div>
      </div>
    )}
  </div>
);

const StatItem = ({ label, value, color }) => (
  <div className="stat-card">
    <span className="stat-label">{label}</span>
    <span className="stat-value" style={{ color }}>{value}</span>
  </div>
);

export default App;
