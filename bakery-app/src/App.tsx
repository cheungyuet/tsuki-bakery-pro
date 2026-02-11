import { useState, useEffect, useRef } from 'react';
import { Plus, Clock, Play, AlertTriangle, X, Layers, RotateCcw, Box, Flame, CheckCircle, Upload } from 'lucide-react';

interface BakeryItem {
  id: number;
  oven: string;
  product: string;
  quantity: number;
  temp: string;
  totalTime: number;
  steam: boolean;
  special?: string;
  note?: string;
  elapsedTime?: number;
  isOvertime?: boolean;
  startTime?: string;
  completedTime?: string;
  isCustom?: boolean;
  addedTime?: string;
  severeWarningAck?: boolean;
}

interface ItemsState {
  queue: BakeryItem[];
  baking: BakeryItem[];
  completed: BakeryItem[];
}

interface CustomFormState {
  product: string;
  topTemp: string;
  bottomTemp: string;
  time: string;
  steam: boolean;
  special: string;
  oven: string;
}

const App = () => {
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState<keyof ItemsState>('queue');
  const [items, setItems] = useState<ItemsState>({ queue: [], baking: [], completed: [] });
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
  // Form States
  const [selectedOven, setSelectedOven] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [customForm, setCustomForm] = useState<CustomFormState>({ product: '', topTemp: '', bottomTemp: '', time: '', steam: false, special: '', oven: '' });
  const [bulkSelection, setBulkSelection] = useState<number[]>([]);
  const [dynamicBakingData, setDynamicBakingData] = useState<any | null>(null);
  const [overtimeAlertItem, setOvertimeAlertItem] = useState<BakeryItem | null>(null);
  
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour12: false }));

  // Pre-load audio to be ready for playback
  const notificationSound = useRef(new Audio('/notification.mp3')); // Ensure notification.mp3 is in the /public folder
  const audioUnlocked = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const unlockAudio = () => {
    if (audioUnlocked.current) return;
    // A common trick to unlock audio context in browsers.
    const sound = notificationSound.current;
    sound.volume = 0;
    sound.play().catch(() => {}).finally(() => {
      sound.pause(); sound.currentTime = 0; sound.volume = 1; audioUnlocked.current = true;
    });
  };

  // --- 完整烘焙數據 ---
  const bakingData: any = {
    'Oven 1': { name: 'Oven 1', priority: 1, products: { 'Sausage Buns': { temp: '220°C/220°C', time: 8, steam: false, priority: 1 }, 'Pork Floss Buns': { temp: '190°C/235°C', time: 8, steam: false, priority: 2 }, 'Coffee Polo Buns': { temp: '195°C/235°C', time: 11, steam: false, priority: 3 }, 'Original Polo Buns': { temp: '200°C/210°C', time: 11, steam: false, priority: 4 }, 'Lava Polo Buns': { temp: '200°C/210°C', time: 16, steam: false, priority: 5 } }},
    'Oven 2': { name: 'Oven 2', priority: 2, products: { 'Cheese Bacon': { temp: '200°C/210°C', time: 12, steam: true, priority: 1 }, 'Mushroom Sausage': { temp: '200°C/210°C', time: 14, steam: true, priority: 2 }, 'Nutty Streusel': { temp: '190°C/200°C', time: 14, steam: true, priority: 3 } }},
    'Oven 3': { name: 'Oven 3', priority: 3, products: { 'Mango Crown Cheese & Mini Pumpkin': { temp: '190°C/210°C', time: 8, steam: true, priority: 1 }, 'Country Grain Honey Fig': { temp: '195°C/210°C', time: 17, steam: true, priority: 2 } }},
    'Oven 4': { name: 'Oven 4', priority: 4, products: { 'Milk Toffee': { temp: '180°C/250°C', time: 11, steam: false, priority: 1 }, 'Original Loaf': { temp: '140°C/250°C', time: 33, steam: false, priority: 2 } }},
    'Oven 5': { name: 'Oven 5', priority: 5, products: { 'Custom Item': { temp: '180°C', time: 15, steam: false, priority: 1 } }},
    'Oven 6': { name: 'Oven 6', priority: 6, products: { 'Custom Item': { temp: '180°C', time: 15, steam: false, priority: 1 } }}
  };

  const dataToUse = dynamicBakingData || bakingData;

  // --- 初始化與持久化 ---
  useEffect(() => {
    // 1. Load dynamic data from CSV in localStorage
    const savedCsvData = localStorage.getItem('bakeryCsvData');
    if (savedCsvData) {
      try {
        setDynamicBakingData(JSON.parse(savedCsvData));
      } catch (e) {
        console.error("Failed to parse CSV data from localStorage", e);
        localStorage.removeItem('bakeryCsvData');
      }
    }

    // 2. Load item states
    const savedItems = localStorage.getItem('bakeryData');
    if (savedItems) {
      try {
        setItems(JSON.parse(savedItems));
      } catch (e) {
        console.error("Failed to parse item data from localStorage", e);
        localStorage.removeItem('bakeryData');
      }
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const timeInterval = setInterval(() => setCurrentTime(new Date().toLocaleTimeString([], { hour12: false })), 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    localStorage.setItem('bakeryData', JSON.stringify(items));
  }, [items]);

  // --- 計時器邏輯 ---
  useEffect(() => {
    const timer = setInterval(() => {
      setItems(prev => ({
        ...prev,
        baking: prev.baking.map((item) => {
          const newElapsed = (item.elapsedTime || 0) + 1;
          const totalSeconds = item.totalTime * 60;
          const targetSeconds = Math.round(totalSeconds);
          const isOvertime = newElapsed > totalSeconds;

          // Trigger sound and notification exactly when the timer hits zero
          // AND when it is overtime by 60 seconds (reminder)
          if (newElapsed === targetSeconds || newElapsed === targetSeconds + 60) {
            notificationSound.current.currentTime = 0;
            notificationSound.current.play().catch(e => console.error("Error playing sound:", e));
            if ('Notification' in window && Notification.permission === 'granted') {
              const msg = newElapsed > targetSeconds ? `${item.product} is OVERTIME (1 min)!` : `${item.product} is ready!`;
              new Notification(msg, { body: `Oven: ${item.oven}`, tag: `item-${item.id}` });
            }
          }
          return { ...item, elapsedTime: newElapsed, isOvertime };
        })
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- 嚴重超時監控 (Overtime > 2 mins) ---
  useEffect(() => {
    if (overtimeAlertItem) return; // 如果已經有彈窗，暫不處理新的

    const severeItem = items.baking.find(item => {
      const elapsed = item.elapsedTime || 0;
      const totalSeconds = item.totalTime * 60;
      // 超時 2 分鐘 = 120 秒
      return elapsed > (totalSeconds + 120) && !item.severeWarningAck;
    });

    if (severeItem) {
      setOvertimeAlertItem(severeItem);
      // 觸發警告時嘗試播放聲音
      notificationSound.current.play().catch(() => {});
    }
  }, [items.baking, overtimeAlertItem]);

  const handleSevereOvertimeConfirm = () => {
    if (!overtimeAlertItem) return;
    
    setItems(prev => ({
      ...prev,
      baking: prev.baking.map(i => 
        i.id === overtimeAlertItem.id 
          ? { ...i, severeWarningAck: true } 
          : i
      )
    }));
    setOvertimeAlertItem(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- 核心操作函數 ---
  const addToQueue = (itemData: Omit<BakeryItem, 'id' | 'addedTime'>) => {
    const newItem = { ...itemData, id: Date.now() + Math.random(), addedTime: new Date().toLocaleTimeString() };
    setItems(prev => ({ ...prev, queue: [...prev.queue, newItem] }));
  };

  const handleAddMultiple = () => {
    if (!selectedOven || selectedProducts.length === 0) return;

    const newItems = selectedProducts.map((productName, index) => {
      const p = dataToUse[selectedOven].products[productName];
      return {
        id: Date.now() + Math.random() + index,
        oven: selectedOven,
        product: productName,
        quantity,
        temp: p.temp,
        totalTime: p.time,
        steam: p.steam,
        special: p.special,
        addedTime: new Date().toLocaleTimeString()
      };
    });

    setItems(prev => ({ ...prev, queue: [...prev.queue, ...newItems] }));

    setShowAddModal(false);
    setSelectedOven(''); setSelectedProducts([]); setQuantity(1);
  };

  const handleAddCustom = () => {
    if (!customForm.product || !customForm.time || !customForm.oven) return;
    addToQueue({
      oven: customForm.oven,
      product: customForm.product,
      quantity: 1,
      temp: (customForm.topTemp || customForm.bottomTemp) ? `${customForm.topTemp || '0'}°C/${customForm.bottomTemp || '0'}°C` : 'Custom',
      totalTime: parseFloat(customForm.time),
      steam: customForm.steam,
      special: customForm.special,
      isCustom: true
    });
    setCustomForm({ product: '', topTemp: '', bottomTemp: '', time: '', steam: false, special: '', oven: '' });
    setShowCustomModal(false);
  };

  const startBaking = (id: number) => {
    const item = items.queue.find(i => i.id === id);
    if (item) {
      const currentOvenCount = items.baking.filter(i => i.oven === item.oven).length;
      if (currentOvenCount >= 4) {
        alert('OVEN FULL');
        return;
      }

      setItems(prev => ({
        ...prev,
        queue: prev.queue.filter(i => i.id !== id),
        baking: [...prev.baking, { ...item, elapsedTime: 0, isOvertime: false, startTime: new Date().toLocaleTimeString() }]
      }));
    }
  };

  const startBulk = () => {
    const selectedItems = items.queue.filter(i => bulkSelection.includes(i.id));
    setItems(prev => ({
      ...prev,
      queue: prev.queue.filter(i => !bulkSelection.includes(i.id)),
      baking: [...prev.baking, ...selectedItems.map(i => ({ ...i, elapsedTime: 0, isOvertime: false, startTime: new Date().toLocaleTimeString() }))]
    }));
    setBulkSelection([]);
    setShowBulkModal(false);
  };

  const toggleBulkSelection = (id: number) => {
    setBulkSelection(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- CSV 導入邏輯 ---
  const parseCsvToBakingData = (csvText: string) => {
    const newBakingData: any = {};
    const rows = csvText.trim().split('\n');
    // Skip header row if it exists by checking for a specific header name
    const startIndex = rows[0].includes('烤箱名稱') ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i].trim();
      if (!row) continue;

      const columns = row.split(',');
      if (columns.length < 6) continue; // Ensure all required columns are present

      const [ovenName, productName, temp, time, steam, priority, special] = columns.map(c => c.trim());

      if (!newBakingData[ovenName]) {
        newBakingData[ovenName] = {
          name: ovenName,
          priority: Object.keys(newBakingData).length + 1, // Assign priority based on order of appearance
          products: {}
        };
      }

      newBakingData[ovenName].products[productName] = {
        temp: temp,
        time: parseFloat(time),
        steam: steam.toLowerCase() === 'true',
        priority: parseInt(priority, 10) || 99,
        special: special || ''
      };
    }
    if (Object.keys(newBakingData).length === 0) {
      throw new Error("CSV is empty or in the wrong format.");
    }
    return newBakingData;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        try {
          const parsedData = parseCsvToBakingData(text);
          setDynamicBakingData(parsedData);
          localStorage.setItem('bakeryCsvData', JSON.stringify(parsedData));
          alert('Baking data imported successfully!');
        } catch (error) {
          console.error("Error parsing CSV:", error);
          alert(`Failed to parse CSV file. Please check the format.\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handleImportClick = () => {
    unlockAudio();
    fileInputRef.current?.click();
  };

  // --- 渲染組件 ---
  const renderItemCard = (item: BakeryItem, category: keyof ItemsState) => (
    <div key={item.id} className={`bg-white rounded-2xl p-4 mb-3 shadow-sm border ${item.isOvertime ? 'border-red-500 animate-pulse' : 'border-slate-100'}`}>
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center flex-1">
          {category === 'queue' && showBulkModal && (
            <input 
              type="checkbox" 
              aria-label={`Select ${item.product} for bulk action`}
              title={`Select ${item.product} for bulk action`}
              checked={bulkSelection.includes(item.id)} 
              onChange={() => toggleBulkSelection(item.id)} 
              className="w-5 h-5 rounded-lg border-2 border-blue-200 cursor-pointer" 
            />
          )}
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              {item.product} {item.isCustom && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black">Custom</span>}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.oven} • {item.quantity} tray(s) • {item.temp}</p>
            {item.steam && <span className="text-[10px] text-blue-500 font-bold">💨 Steam Required</span>}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {category === 'baking' && (
            (() => {
              const remainingSeconds = (item.totalTime * 60) - (item.elapsedTime || 0);
              return (
                <span className={`font-mono font-black text-lg ${item.isOvertime ? 'text-red-600' : 'text-blue-600'}`}>
                  {item.isOvertime ? `+${formatTime(Math.abs(remainingSeconds))}` : formatTime(remainingSeconds)}
                </span>
              );
            })()
          )}
          
          <div className="flex gap-1 mt-1">
            {category === 'baking' && (
              <button 
                onClick={() => setItems(prev => ({...prev, baking: prev.baking.filter(i => i.id !== item.id), completed: [...prev.completed, {...item, completedTime: new Date().toLocaleTimeString()}]}))} 
                className="bg-green-500 text-white rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 px-4 py-2 active:scale-95"
                title="Mark as Done"
                aria-label={`Mark ${item.product} as Done`}
              >
                <CheckCircle size={16}/>
                <span className="font-black text-sm">DONE</span>
              </button>
            )}
            
            {category === 'queue' && !showBulkModal && (
              <button 
                onClick={() => startBaking(item.id)} 
                className="bg-blue-700 text-white rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 px-4 py-2 active:scale-95"
                title="Start Baking"
                aria-label={`Start Baking ${item.product}`}
              >
                <Play size={16}/>
                <span className="font-black text-sm">START</span>
              </button>
            )}
            
            <button 
              onClick={() => setItems(prev => ({...prev, [category]: prev[category].filter(i => i.id !== item.id)}))} 
              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title={`Remove ${item.product}`}
              aria-label={`Remove ${item.product}`}
            >
              <X size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const EmptyState = ({ label }: { label: string }) => (
    <div className="text-center py-20 text-gray-300 flex flex-col items-center justify-center h-full">
      <Box size={48} className="opacity-20 mb-2"/>
      <p className="text-sm uppercase font-bold tracking-widest">No Items in {label}</p>
    </div>
  );

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-30 flex justify-between items-center">
        <h1 className="text-xl font-black italic text-orange-500 flex items-center gap-2">
          <Flame /> Tsuki QLD Bakery Pro
        </h1>
        <div className="flex items-center gap-4">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" title="Import CSV file" />
          <button onClick={handleImportClick} title="Import CSV" className="bg-slate-700 hover:bg-slate-600 text-orange-400 p-2 rounded-lg transition-colors active:scale-95">
            <Upload size={20} />
          </button>
          <div className="text-lg font-mono font-black bg-slate-700 px-4 py-1 rounded-lg">{currentTime}</div>
        </div>
      </header>

      {/* 主看板區域 */}
      <main className="flex-1 p-4 lg:p-8 flex flex-col gap-6 overflow-hidden pb-48 lg:pb-8">
        {/* 手機版分頁標籤 */}
        <nav className="flex bg-white border-b sticky top-0 z-10 lg:hidden rounded-xl shadow-sm mb-4 overflow-hidden">
          {(['queue', 'baking', 'completed'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-bold uppercase transition-colors ${activeTab === tab ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
            >
              {tab} ({items[tab].length})
            </button>
          ))}
        </nav>

        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 flex-1 overflow-hidden">
          {/* 1. Queue - 淡藍 */}
          <section className={`bg-blue-50/50 rounded-[2.5rem] p-4 border border-blue-100 flex flex-col h-full relative lg:col-span-1 min-w-0 ${activeTab !== 'queue' && 'hidden lg:flex'}`}>
            <h2 className="text-blue-700 font-black flex items-center gap-2 mb-4 uppercase tracking-tighter"><Box size={18}/> Queue ({items.queue.length})</h2>
            {showBulkModal && bulkSelection.length > 0 && (
              <div className="mb-4">
                <button onClick={startBulk} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:brightness-110 transition-all">Start Baking ({bulkSelection.length})</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-24">
              {items.queue.length === 0 ? <EmptyState label="Queue" /> : items.queue.map(i => renderItemCard(i, 'queue'))}
            </div>
          </section>

          {/* 2. Baking - Grid of 6 Ovens */}
          <section className={`bg-orange-50/50 rounded-[2.5rem] p-4 border border-orange-100 flex flex-col h-full overflow-hidden lg:col-span-3 ${activeTab !== 'baking' && 'hidden lg:flex'}`}>
            <h2 className="text-orange-700 font-black flex items-center gap-2 mb-4 uppercase tracking-tighter"><Flame size={18}/> Baking ({items.baking.length})</h2>
            <div className="flex-1 min-h-0">
              <div className="grid grid-cols-2 grid-rows-3 gap-3 h-full">
                {Object.keys(dataToUse).map((ovenKey) => {
                  const ovenItems = items.baking.filter(i => i.oven === ovenKey);
                  const isFull = ovenItems.length >= 4;
                  return (
                    <div key={ovenKey} className={`bg-white/80 rounded-xl border-2 ${isFull ? 'border-red-400' : 'border-orange-200'} p-2 flex flex-col h-full relative overflow-hidden shadow-sm`}>
                      <div className={`text-sm font-black uppercase mb-1 border-b-2 pb-1 flex justify-between items-center ${isFull ? 'text-red-600 border-red-100' : 'text-orange-800 border-orange-100'}`}>
                        <span>{ovenKey} {isFull && '(FULL)'}</span>
                        <span className={`${isFull ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'} px-1.5 rounded-full`}>{ovenItems.length}/4</span>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {ovenItems.map(item => (
                          <div key={item.id} className={`bg-white rounded-lg p-2 border-2 ${item.isOvertime ? 'border-red-500 bg-red-50' : 'border-slate-100'} shadow-sm relative group flex justify-between items-center`}>
                            <div className="min-w-0 flex-1">
                              <div className="font-black text-2xl text-slate-800 truncate leading-tight">{item.product}</div>
                              <div className="font-bold text-lg text-slate-500 mt-0.5">{item.quantity} trays • {item.temp}</div>
                            </div>
                            <div className="flex items-center gap-3 ml-2">
                              <div className={`font-mono font-black text-4xl ${item.isOvertime ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                                {(() => {
                                  const remainingSeconds = (item.totalTime * 60) - (item.elapsedTime || 0);
                                  return item.isOvertime ? `+${formatTime(Math.abs(remainingSeconds))}` : formatTime(remainingSeconds);
                                })()}
                              </div>
                              <button 
                                onClick={() => setItems(prev => ({...prev, baking: prev.baking.filter(i => i.id !== item.id), completed: [...prev.completed, {...item, completedTime: new Date().toLocaleTimeString()}]}))}
                                className="text-green-500 hover:bg-green-50 p-1 rounded transition-colors"
                                title="Done"
                              >
                                <CheckCircle size={28} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Completed - 淡綠 */}
          <section className={`bg-green-50/50 rounded-[2.5rem] p-4 border border-green-100 flex flex-col h-full overflow-hidden lg:col-span-1 min-w-0 ${activeTab !== 'completed' && 'hidden lg:flex'}`}>
            <h2 className="text-green-700 font-black flex items-center gap-2 mb-4 uppercase tracking-tighter"><CheckCircle size={18}/> Done ({items.completed.length})</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {items.completed.length === 0 ? <EmptyState label="Done" /> : items.completed.map(i => renderItemCard(i, 'completed'))}
            </div>
          </section>
        </div>
      </main>

      {/* 手機底部導航 */}
      <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-xl border-t p-4 z-50 pb-8">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-3">
          <button onClick={() => { unlockAudio(); setShowAddModal(true); }} title="Add Item" className="bg-blue-600 text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all">
            <Plus size={20}/> <span className="hidden sm:inline">Add</span>
          </button>
          <button onClick={() => { unlockAudio(); setShowBulkModal(!showBulkModal); }} title="Bulk Actions" className={`py-3 rounded-2xl font-black flex items-center justify-center transition-all active:scale-95 ${showBulkModal ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Layers size={20}/> <span className="hidden sm:inline">Bulk</span>
          </button>
          <button onClick={() => { unlockAudio(); setShowCustomModal(true); }} title="Custom Item" className="bg-slate-100 text-slate-500 py-3 rounded-2xl font-black flex items-center justify-center active:scale-95 transition-all">
            <Clock size={20}/> <span className="hidden sm:inline">Custom</span>
          </button>
          <button onClick={() => { unlockAudio(); setShowResetModal(true); }} title="Reset Data" className="bg-red-50 text-red-500 py-3 rounded-2xl font-black flex items-center justify-center active:scale-95 transition-all">
            <RotateCcw size={20}/> <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </footer>

      {/* --- Modals --- */}

      {/* 新增項目彈窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-100 backdrop-blur-sm">
          <div className="bg-white rounded-4xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-slate-800">Add Item</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">1. Select Oven</label>
                <select title="Select Oven" aria-label="Select Oven" onChange={(e) => {setSelectedOven(e.target.value); setSelectedProducts([]);}} className="w-full border-2 border-gray-100 rounded-xl p-3 mt-1 focus:border-blue-500 outline-none transition-all font-bold text-slate-700">
                  <option value="">Select Oven...</option>
                  {Object.keys(dataToUse).map(o => <option key={o} value={o}>{dataToUse[o].name}</option>)}
                </select>
              </div>
              {selectedOven && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">2. Select Product(s)</label>
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-3 border-2 border-gray-100 rounded-xl p-4 custom-scrollbar">
                      {Object.keys(dataToUse[selectedOven].products).map(p => (
                        <div key={p} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`product-${p}`}
                            checked={selectedProducts.includes(p)}
                            onChange={() => setSelectedProducts(prev => prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p])}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                          />
                          <label htmlFor={`product-${p}`} className="ml-3 font-bold text-slate-700 cursor-pointer select-none">{p}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="quantity-input" className="text-[10px] font-bold text-gray-400 uppercase">3. Quantity (per product)</label>
                    <input
                      id="quantity-input"
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full border-2 border-gray-100 rounded-xl p-3 mt-1 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">Cancel</button>
                <button onClick={handleAddMultiple} disabled={!selectedOven || selectedProducts.length === 0} className="flex-2 bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:brightness-110 transition-all disabled:bg-slate-300 disabled:shadow-none">Add to Queue ({selectedProducts.length})</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 臨時項目彈窗 */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-100">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-6 text-slate-800">Add Custom Item</h2>
            <div className="space-y-4">
              <select 
                value={customForm.oven} 
                onChange={e => setCustomForm({...customForm, oven: e.target.value})} 
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Select Oven...</option>
                {Object.keys(dataToUse).map(o => <option key={o} value={o}>{dataToUse[o].name}</option>)}
              </select>
              <input placeholder="Product Name" value={customForm.product} onChange={e => setCustomForm({...customForm, product: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
              <div className="grid grid-cols-2 gap-4">
              <input placeholder="Top Temp" type="number" value={customForm.topTemp} onChange={e => setCustomForm({...customForm, topTemp: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
              <input placeholder="Bottom Temp" type="number" value={customForm.bottomTemp} onChange={e => setCustomForm({...customForm, bottomTemp: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            <input placeholder="Time (min)" type="number" step="0.5" value={customForm.time} onChange={e => setCustomForm({...customForm, time: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
              <div className="flex items-center gap-2 p-2">
                 <input type="checkbox" id="steam" checked={customForm.steam} onChange={e => setCustomForm({...customForm, steam: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                 <label htmlFor="steam" className="font-bold text-slate-600">Steam Required</label>
              </div>
              <button onClick={handleAddCustom} disabled={!customForm.product || !customForm.time || !customForm.oven} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black mt-4 hover:brightness-110 transition-all shadow-lg shadow-orange-200 disabled:bg-slate-300 disabled:shadow-none">Add to Queue</button>
              <button onClick={() => setShowCustomModal(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 重設確認彈窗 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-red-500/20 backdrop-blur-md flex items-center justify-center p-4 z-100">
          <div className="bg-white rounded-4xl p-8 w-full max-w-sm text-center shadow-2xl animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle size={32}/>
            </div>
            <h2 className="text-2xl font-black text-slate-800">Confirm Clear All</h2>
            <p className="text-gray-500 text-sm mt-2">This will delete all queued, baking, and completed data. This action cannot be undone.</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-3 font-bold text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">Keep Data</button>
              <button onClick={() => {setItems({queue:[], baking:[], completed:[]}); setShowResetModal(false);}} className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-red-200">Confirm & Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* 嚴重超時警告彈窗 (Critical Alert) */}
      {overtimeAlertItem && (
        <div className="fixed inset-0 bg-red-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
          <div className="bg-white rounded-4xl p-8 w-full max-w-sm text-center shadow-2xl animate-in fade-in zoom-in duration-200 border-4 border-red-600">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <AlertTriangle size={40}/>
            </div>
            <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter mb-2">CRITICAL ALERT</h2>
            <p className="text-slate-800 font-bold text-lg">{overtimeAlertItem.product}</p>
            <p className="text-slate-500 font-medium mb-6">
              {overtimeAlertItem.oven} is overtime by &gt; 2 mins!
            </p>
            
            <button 
              onClick={handleSevereOvertimeConfirm} 
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-xl shadow-lg shadow-red-300 hover:brightness-110 transition-all active:scale-95"
            >
              CONFIRM & DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App
