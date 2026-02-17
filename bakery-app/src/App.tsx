import { useState, useEffect, useRef } from 'react';
import { Clock, Play, AlertTriangle, X, Layers, RotateCcw, Box, Flame, CheckCircle, Upload, Pencil, Trash2, Delete } from 'lucide-react';

interface BakeryItem {
  id: number;
  oven: string;
  product: string;
  quantity: number;
  temp: string;
  totalTime: number;
  steam: boolean;
  special?: string;
  ovenGroup?: string;
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

const OVENS = [
  { name: 'Steam Oven 1', capacity: 4 },
  { name: 'Steam Oven 2', capacity: 4 },
  { name: 'Steam Oven 3', capacity: 4 },
  { name: 'Steam Oven 4', capacity: 4 },
  { name: 'No Steam Oven 5', capacity: 3 },
  { name: 'No Steam Oven 6', capacity: 3 },
  { name: 'No Steam Oven 7', capacity: 3 },
  { name: 'Convection Oven 8', capacity: 6 },
];

const PRESET_ITEMS_CSV = `Sausage Buns,10,200C/220C,8,Steam Oven 1-4,No
Corn/Scallion Bun,12,200C/210C,10,Steam Oven 1-4,No
Pork Floss Bun,8,175C/210C,12,Steam Oven 1-4,No
Milk Bun,15,175C/210C,15,Steam Oven 1-4,No
Green Tea Red Bean,10,175C/210C,15,Steam Oven 1-4,No
Honey Cheese Stick,12,210C/200C,12,Steam Oven 1-4,No
Ham & Cheese Bun,10,210C/200C,12,Steam Oven 1-4,No
Red Bean Bun,10,200C/190C,10,Steam Oven 1-4,No
Taro Bun,10,200C/210C,10,Steam Oven 1-4,No
Coffee Pineapple Bun,8,200C/210C,11,Steam Oven 1-4,No
Original Pineapple Bun,10,200C/210C,11,Steam Oven 1-4,No
Chocolate Pineapple Bun,8,200C/210C,12,Steam Oven 1-4,No
Mango Pineapple Bun,8,200C/210C,12,Steam Oven 1-4,No
Lava Pineapple Bun,6,200C/210C,16,Steam Oven 1-4,No
Bacon & Cheese,12,200C/210C,12,Steam Oven 1-4,Yes
Mushroom Sausage Bun,12,200C/210C,14,Steam Oven 1-4,Yes
Hazelnut Chocolate,10,190C/210C,8,Steam Oven 1-4,Yes
Black Eye Pea,15,190C/210C,8,Steam Oven 1-4,Yes
Mango Cheese,10,190C/210C,12,Steam Oven 1-4,Yes
Pumpkin Bun,10,190C/210C,12,Steam Oven 1-4,Yes
Original Loaf,5,140C/250C,33,No Steam Oven 5-7,No
Pumpkin Loaf,5,150C/230C,33,No Steam Oven 5-7,No
Whole Wheat Loaf,5,150C/230C,35,No Steam Oven 5-7,No
Biscoff Danish,8,160C,17,Convection Oven 8,Yes
Pistachio Croissant,8,175C,20,Convection Oven 8,No
Danish Toast,4,150C,43,Convection Oven 8,No
Layered Toast,6,150C,32,Convection Oven 8,No
Q-Heart Mochi,12,160C,50,Convection Oven 8,Yes
Large Croissant,16,160C,17,Convection Oven 8,Yes
Baguette,6,165C,11,Convection Oven 8,Yes`;

const getPresetQueue = (): BakeryItem[] => PRESET_ITEMS_CSV.split('\n').map((line, index) => {
  const [product, quantity, temp, time, ovenGroupCSV, steam] = line.split(',');
  
  let groupName = '';
  const ovenGroupName = ovenGroupCSV.trim();

  if (ovenGroupName === 'Steam Oven 1-4') {
    groupName = 'Group A';
  } else if (ovenGroupName === 'No Steam Oven 5-7') {
    groupName = 'Group B';
  } else if (ovenGroupName === 'Convection Oven 8') {
    groupName = 'Group C';
  }

  return {
    id: Date.now() + index,
    product: product.trim(),
    quantity: parseInt(quantity, 10),
    temp: temp.trim(),
    totalTime: parseFloat(time),
    oven: groupName, // Display 'Group A', 'Group B', etc. in the queue card
    ovenGroup: groupName, // Use 'Group A', 'Group B', etc. for logic
    steam: steam.trim().toLowerCase() === 'yes',
  };
});

const PRESET_DATA: ItemsState = {
  queue: getPresetQueue(),
  baking: [],
  completed: [],
};

const App = () => {
  // --- 狀態管理 ---
  const [activeTab, setActiveTab] = useState<keyof ItemsState>('queue');
  const [items, setItems] = useState<ItemsState>(() => PRESET_DATA);
  
  // Modals
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [showEditMasterModal, setShowEditMasterModal] = useState(false);
  
  // Form States
  const [customForm, setCustomForm] = useState<CustomFormState>({ product: '', topTemp: '', bottomTemp: '', time: '', steam: false, special: '', oven: '' });
  const [bulkSelection, setBulkSelection] = useState<number[]>([]);
  const [editableQueue, setEditableQueue] = useState<BakeryItem[]>([]);
  const [overtimeAlertItem, setOvertimeAlertItem] = useState<BakeryItem | null>(null);
  const [startBakingInfo, setStartBakingInfo] = useState<{ item: BakeryItem; targetOven?: string } | null>(null);

  // Pre-load audio to be ready for playback
  const [currentTime, setCurrentTime] = useState(new Date());
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

  // --- 初始化與持久化 ---
  useEffect(() => {
    // Load item states from localStorage
    const savedItems = localStorage.getItem('tsuki-bakery-data');
    if (savedItems) {
      try {
        setItems(JSON.parse(savedItems));
      } catch (e) {
        console.error("Failed to parse item data from localStorage", e);
        // If parsing fails, start with preset
        setItems(PRESET_DATA);
        localStorage.setItem('tsuki-bakery-data', JSON.stringify(PRESET_DATA));
      }
    } else {
      // First time load, use preset data and save it
      setItems(() => PRESET_DATA);
      localStorage.setItem('tsuki-bakery-data', JSON.stringify(PRESET_DATA));
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    localStorage.setItem('tsuki-bakery-data', JSON.stringify(items));
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

  const formatFullDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${year}/${month}/${day} - ${timeString}`;
  };

  // --- 核心操作函數 ---
  const addToQueue = (itemData: Omit<BakeryItem, 'id' | 'addedTime'>) => {
    const newItem = { ...itemData, id: Date.now() + Math.random(), addedTime: new Date().toLocaleTimeString() };
    setItems(prev => ({ ...prev, queue: [...prev.queue, newItem] }));
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

  const handleReset = () => {
    setItems(prev => {
      const itemsToMove = [...prev.baking, ...prev.completed].map(item => {
        const { elapsedTime, startTime, completedTime, isOvertime, severeWarningAck, ...rest } = item;
        return rest;
      });
      return {
        queue: [...prev.queue, ...itemsToMove],
        baking: [],
        completed: []
      };
    });
    setShowResetModal(false);
  };

  const handleRecover = () => {
    localStorage.removeItem('tsuki-bakery-data');
    setItems({ queue: getPresetQueue(), baking: [], completed: [] });
    setShowRecoverModal(false);
  };

  const handleConfirmStartBaking = (quantityToBake: number) => {
    if (!startBakingInfo) return;
    const { item, targetOven: preselectedOven } = startBakingInfo;

    if (quantityToBake <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }
    if (quantityToBake > item.quantity) {
        alert(`Cannot bake ${quantityToBake} trays. Only ${item.quantity} remaining in queue.`);
        return;
    }

    let assignedOven: string | null = null;
    let targetOvens: string[] = [];

    // Case 1: An oven was pre-selected via drag-and-drop
    if (preselectedOven) {
        if (!checkOvenCompatibility(item, preselectedOven)) {
            alert('Wrong Oven Type for this Product!');
            setStartBakingInfo(null); // Close modal on error
            return;
        }
        targetOvens = [preselectedOven];
    } 
    // Case 2: Find an oven from the group
    else {
        const { ovenGroup } = item;
        if (ovenGroup === 'Group A') {
            targetOvens = ['Steam Oven 1', 'Steam Oven 2', 'Steam Oven 3', 'Steam Oven 4'];
        } else if (ovenGroup === 'Group B') {
            targetOvens = ['No Steam Oven 5', 'No Steam Oven 6', 'No Steam Oven 7'];
        } else if (ovenGroup === 'Group C') {
            targetOvens = ['Convection Oven 8'];
        } else {
            targetOvens = [item.oven]; // Fallback for items without a group
        }
    }

    // Find an oven with enough capacity
    for (const ovenName of targetOvens) {
        const ovenConfig = OVENS.find(o => o.name === ovenName);
        if (!ovenConfig) continue;

        const currentLoad = items.baking
            .filter(i => i.oven === ovenName)
            .reduce((sum, i) => sum + i.quantity, 0);

        if (currentLoad + quantityToBake <= ovenConfig.capacity) {
            assignedOven = ovenName;
            break; // Found a spot
        }
    }

    if (assignedOven) {
        const finalOvenName = assignedOven; // for closure

        setItems(prev => {
            const newBakingItem: BakeryItem = {
                ...item,
                id: Date.now() + Math.random(), // New unique ID for this batch
                quantity: quantityToBake, // The quantity for this specific batch
                oven: finalOvenName,
                elapsedTime: 0,
                isOvertime: false,
                startTime: new Date().toLocaleTimeString()
            };

            const updatedQueue = prev.queue.map(qItem => {
                if (qItem.id === item.id) {
                    return { ...qItem, quantity: qItem.quantity - quantityToBake };
                }
                return qItem;
            }).filter(qItem => qItem.quantity > 0); // Remove if quantity is 0 or less

            return { ...prev, queue: updatedQueue, baking: [...prev.baking, newBakingItem] };
        });

        setStartBakingInfo(null); // Success, close modal
    } else {
        const groupName = preselectedOven ? preselectedOven : (item.ovenGroup || 'the target group');
        alert(`No oven in ${groupName} has enough capacity for ${quantityToBake} trays.`);
    }
  };

  const startBaking = (id: number) => {
    const item = items.queue.find(i => i.id === id);
    if (!item) return;
    setStartBakingInfo({ item });
  };

  const startBulk = () => {
    const selectedItems = items.queue.filter(i => bulkSelection.includes(i.id));
    const currentBaking = [...items.baking];
    const assignments: { item: BakeryItem, assignedOven: string }[] = [];
    let possible = true;

    for (const item of selectedItems) {
      const { ovenGroup } = item;
      let targetOvens: string[] = [];

      if (ovenGroup === 'Group A') {
        targetOvens = ['Steam Oven 1', 'Steam Oven 2', 'Steam Oven 3', 'Steam Oven 4'];
      } else if (ovenGroup === 'Group B') {
        targetOvens = ['No Steam Oven 5', 'No Steam Oven 6', 'No Steam Oven 7'];
      } else if (ovenGroup === 'Group C') {
        targetOvens = ['Convection Oven 8'];
      } else {
        targetOvens = [item.oven];
      }

      let foundSpot = false;
      for (const ovenName of targetOvens) {
        const ovenConfig = OVENS.find(o => o.name === ovenName);
        if (!ovenConfig) continue;

        // Check capacity against current + planned items
        const futureLoad = currentBaking
          .filter(i => i.oven === ovenName)
          .reduce((sum, i) => sum + i.quantity, 0);

        if (futureLoad + item.quantity <= ovenConfig.capacity) {
          assignments.push({ item, assignedOven: ovenName });
          // Add a placeholder to currentBaking to reserve the spot for the next iteration
          currentBaking.push({ ...item, oven: ovenName });
          foundSpot = true;
          break;
        }
      }

      if (!foundSpot) {
        alert(`Cannot start bulk baking. No available oven found for ${item.product} in ${item.ovenGroup}.`);
        possible = false;
        break;
      }
    }

    if (possible) {
      setItems(prev => {
        const newBakingItems = assignments.map(({ item, assignedOven }) => ({
          ...item,
          oven: assignedOven,
          elapsedTime: 0,
          isOvertime: false,
          startTime: new Date().toLocaleTimeString()
        }));
        return {
          ...prev,
          queue: prev.queue.filter(i => !bulkSelection.includes(i.id)),
          baking: [...prev.baking, ...newBakingItems]
        };
      });
      setBulkSelection([]);
      setShowBulkModal(false);
    }
  };

  const toggleBulkSelection = (id: number) => {
    setBulkSelection(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- CSV 導入邏輯 ---
  const parseCsvToQueue = (csvText: string): BakeryItem[] => {
    const newQueue: BakeryItem[] = [];
    const rows = csvText.trim().split('\n');
    // Skip header row if it exists by checking for 'product'
    const startIndex = rows[0].toLowerCase().includes('product') ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i].trim();
      if (!row) continue;

      const columns = row.split(',');
      if (columns.length < 5) continue; // product,quantity,temp,time,oven

      const [product, quantity, temp, time, oven, steam] = columns.map(c => c.trim());

      newQueue.push({
        id: Date.now() + Math.random() + i,
        product: product || 'Unnamed Product',
        quantity: parseInt(quantity, 10) || 1,
        temp: temp || '180°C/180°C',
        totalTime: parseFloat(time) || 10,
        oven: oven || 'Oven 1',
        steam: steam?.toLowerCase() === 'true' || false,
        addedTime: new Date().toLocaleTimeString(),
        // Ensure other optional fields are not undefined
        elapsedTime: 0,
        isOvertime: false,
        isCustom: false,
      });
    }
    if (newQueue.length === 0) {
      throw new Error("CSV is empty or in the wrong format. Expected columns: product,quantity,temp,time,oven,steam");
    }
    return newQueue;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        try {
          const newQueue = parseCsvToQueue(text);
          // Overwrite queue and save immediately
          setItems(prev => {
            const newItemsState = { ...prev, queue: newQueue };
            localStorage.setItem('tsuki-bakery-data', JSON.stringify(newItemsState));
            return newItemsState;
          });
          alert(`Import successful! ${newQueue.length} items have replaced the queue.`);
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

  // --- Edit Master Modal Handlers ---
  const handleOpenEditMaster = () => {
    setEditableQueue(JSON.parse(JSON.stringify(items.queue))); // Deep copy to prevent direct mutation
    setShowEditMasterModal(true);
  };

  const handleUpdateEditableItem = (id: number, field: keyof BakeryItem, value: any) => {
    setEditableQueue(currentQueue => 
      currentQueue.map(item => {
        if (item.id !== id) return item;
        const updates: any = { [field]: value };
        // Automatically update ovenGroup if oven selection changes to a Group
        if (field === 'oven') {
          if (['Group A', 'Group B', 'Group C'].includes(value)) {
            updates.ovenGroup = value;
          } else {
            updates.ovenGroup = undefined;
          }
        }
        return { ...item, ...updates };
      })
    );
  };

  const handleAddEditableItem = () => {
    const newItem: BakeryItem = {
      id: Date.now() + Math.random(),
      product: 'New Product', quantity: 1, temp: '180°C/180°C', totalTime: 10,
      oven: 'Oven 1', steam: false,
    };
    setEditableQueue(currentQueue => [newItem, ...currentQueue]);
  };

  const handleDeleteEditableItem = (id: number) => {
    setEditableQueue(currentQueue => currentQueue.filter(item => item.id !== id));
  };

  const handleSaveMasterEdits = () => {
    setItems(prev => ({ ...prev, queue: editableQueue }));
    setShowEditMasterModal(false);
  };

  const checkOvenCompatibility = (item: BakeryItem, targetOvenName: string): boolean => {
    const itemOvenGroup = item.ovenGroup;

    // Custom items without a group are compatible with any oven
    if (!itemOvenGroup) {
      return true;
    }

    if (itemOvenGroup === 'Group A') {
      return ['Steam Oven 1', 'Steam Oven 2', 'Steam Oven 3', 'Steam Oven 4'].includes(targetOvenName);
    }
    if (itemOvenGroup === 'Group B') {
      return ['No Steam Oven 5', 'No Steam Oven 6', 'No Steam Oven 7'].includes(targetOvenName);
    }
    if (itemOvenGroup === 'Group C') {
      return targetOvenName === 'Convection Oven 8';
    }

    return false; // Default to not compatible if group is unknown
  };

  const handleDropOnOven = (itemJSON: string, targetOvenName: string) => {
    const item: BakeryItem = JSON.parse(itemJSON);
    // Open the modal to ask for quantity, instead of moving the item directly.
    // The modal will handle compatibility and capacity checks upon confirmation.
    setStartBakingInfo({ item, targetOven: targetOvenName });
  };

  // --- 渲染組件 ---
  const renderItemCard = (item: BakeryItem, category: keyof ItemsState) => (
    <div 
      key={item.id} 
      draggable={category === 'queue' && !showBulkModal}
      onDragStart={(e) => {
        if (category === 'queue') {
          e.dataTransfer.setData('application/json', JSON.stringify(item));
          e.dataTransfer.effectAllowed = 'move';
        }
      }}
      className={`bg-white rounded-2xl p-4 mb-3 shadow-sm border ${item.isOvertime ? 'border-red-500 animate-pulse' : 'border-slate-100'} ${category === 'queue' && !showBulkModal ? 'cursor-grab' : ''}`}>
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

  const totalItems = items.queue.length + items.baking.length + items.completed.length;
  const progressPercentage = totalItems > 0 ? (items.completed.length / totalItems) * 100 : 0;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-slate-900 text-white p-3 sm:p-4 shadow-lg sticky top-0 z-30 flex justify-between items-center gap-2">
        <h1 className="text-lg sm:text-2xl md:text-4xl font-black italic text-orange-500 flex items-center gap-2 truncate">
          <Flame className="shrink-0 w-6 h-6 sm:w-8 sm:h-8 md:w-auto md:h-auto" /> <span className="truncate">Tsuki QLD Bakery Pro System</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-xl font-mono font-black text-center text-slate-300">
            {formatFullDateTime(currentTime)}
          </div>
          <button onClick={() => { unlockAudio(); setShowRecoverModal(true); }} title="Factory Reset" className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors active:scale-95 flex items-center gap-2">
            <AlertTriangle size={24} />
            <span className="font-bold text-base hidden md:inline">Recover</span>
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 border-y border-white/20">
        <div className="relative h-4">
          <div
            className="bg-blue-600 h-full transition-all duration-500 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-size-[1rem_1rem] animate-pulse"
            style={{ width: `${progressPercentage}%` }}
          ></div>
          <div
            className="absolute top-1/2 -translate-y-1/2 text-lg transition-all duration-500"
            style={{ left: `calc(${progressPercentage}% - 12px)` }}
          >
            {progressPercentage >= 100 ? '🥇' : '🚀'}
          </div>
        </div>
      </div>

{/* 主看板區域 */}
      <main className="flex-1 flex flex-col landscape:flex-row gap-2 sm:gap-4 p-2 sm:p-4 overflow-hidden min-h-0">
        
        {/* 統一的手機/直屏版分頁標籤 (由兩組舊代碼整合，移除重複) */}
        <nav className="flex bg-white border-b sticky top-0 z-10 landscape:hidden rounded-xl shadow-sm mb-2 overflow-hidden shrink-0">
          {(['queue', 'baking', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 font-black uppercase transition-all ${
                activeTab === tab 
                  ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50' 
                  : 'text-slate-400'
              }`}
            >
              {tab} ({items[tab].length})
            </button>
          ))}
        </nav>

        {/* 1. Queue - 邏輯：直屏按 Tab 顯示，橫屏必顯示 */}
        <section className={`bg-blue-50/50 rounded-3xl sm:rounded-[2.5rem] p-3 sm:p-4 border border-blue-100 flex-col h-full relative landscape:w-80 min-w-0 ${activeTab === 'queue' ? 'flex' : 'hidden'} landscape:flex`}>
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

        {/* 2. Baking - 維持原有的 Oven 排列不變 */}
        <section className={`bg-orange-50/50 rounded-3xl sm:rounded-[2.5rem] p-3 sm:p-4 border border-orange-100 flex-col flex-1 min-h-0 overflow-hidden ${activeTab === 'baking' ? 'flex' : 'hidden'} landscape:flex`}>
          <h2 className="text-orange-700 font-black flex items-center gap-2 mb-4 uppercase tracking-tighter"><Flame size={18}/> Baking ({items.baking.length})</h2>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {/* 這裡完全維持你要求的高度與排列 */}
            <div className="grid grid-cols-2 landscape:grid-cols-4 gap-2 sm:gap-3 h-full">
              {OVENS.map((oven) => {
                const ovenItems = items.baking.filter(i => i.oven === oven.name);
                const currentLoad = ovenItems.reduce((sum, i) => sum + i.quantity, 0);
                const isFull = currentLoad >= oven.capacity;
                return (
                  <div 
                    key={oven.name} 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const itemJSON = e.dataTransfer.getData('application/json');
                      if (itemJSON) handleDropOnOven(itemJSON, oven.name);
                    }}
                    className={`bg-white/80 rounded-xl border-2 ${isFull ? 'border-red-400' : 'border-orange-200'} p-2 flex flex-col h-full min-h-0 relative overflow-hidden shadow-sm`}>
                    <div className={`text-xs font-black uppercase mb-1 border-b-2 pb-1 flex justify-between items-center ${isFull ? 'text-red-600 border-red-100' : 'text-orange-800 border-orange-100'}`}>
                      <span>{oven.name} {isFull && '(FULL)'}</span>
                      <span className={`${isFull ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'} px-1.5 rounded-full`}>{currentLoad}/{oven.capacity}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                      {ovenItems.map(item => (
                        <div key={item.id} className={`bg-white rounded-lg p-2 border-2 ${item.isOvertime ? 'border-red-500 bg-red-50' : 'border-slate-100'} shadow-sm relative group flex justify-between items-center`}>
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-sm text-slate-800 truncate leading-tight">{item.product}</div>
                            <div className="font-bold text-xs text-slate-500 mt-0.5">{item.quantity} trays • {item.temp}</div>
                          </div>
                          <div className="flex items-center gap-3 ml-2">
                            <div className={`font-mono font-black text-lg ${item.isOvertime ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
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

        {/* 3. Completed - 邏輯：直屏按 Tab 顯示，橫屏必顯示 */}
        <section className={`bg-green-50/50 rounded-3xl sm:rounded-[2.5rem] p-3 sm:p-4 border border-green-100 flex-col h-full overflow-hidden landscape:w-80 min-w-0 ${activeTab === 'completed' ? 'flex' : 'hidden'} landscape:flex`}>
          <h2 className="text-green-700 font-black flex items-center gap-2 mb-4 uppercase tracking-tighter"><CheckCircle size={18}/> Done ({items.completed.length})</h2>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {items.completed.length === 0 ? <EmptyState label="Done" /> : items.completed.map(i => renderItemCard(i, 'completed'))}
          </div>
        </section>
      </main>

      {/* 手機底部導航 */}
      <footer className="bg-white border-t p-2 sm:p-4">
        <div className="max-w-7xl mx-auto grid grid-cols-5 gap-1 sm:gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
          <button onClick={handleImportClick} title="Import CSV" className="py-2 rounded-lg font-bold flex flex-col items-center justify-center transition-all active:scale-95 bg-blue-600 text-white text-xs sm:text-sm">
            <Upload size={20}/> <span className="mt-1">Import</span>
          </button>
          <button onClick={handleOpenEditMaster} title="Edit Master" className="py-2 rounded-lg font-bold flex flex-col items-center justify-center transition-all active:scale-95 bg-orange-500 text-white text-xs sm:text-sm">
            <Pencil size={20}/> <span className="mt-1">Edit</span>
          </button>
          <button onClick={() => { unlockAudio(); setShowCustomModal(true); }} title="Custom Item" className="py-2 rounded-lg font-bold flex flex-col items-center justify-center transition-all active:scale-95 bg-green-600 text-white text-xs sm:text-sm">
            <Clock size={20}/> <span className="mt-1">Custom</span>
          </button>
          <button onClick={() => { unlockAudio(); setShowBulkModal(!showBulkModal); }} title="Bulk Actions" className={`py-2 rounded-lg font-bold flex flex-col items-center justify-center transition-all active:scale-95 text-xs sm:text-sm ${showBulkModal ? 'bg-yellow-500 text-black' : 'bg-slate-100 text-slate-500'}`}>
            <Layers size={20}/> <span className="mt-1">Bulk</span>
          </button>
          <button onClick={() => { unlockAudio(); setShowResetModal(true); }} title="Reset Progress" className="py-2 rounded-lg font-bold flex flex-col items-center justify-center transition-all active:scale-95 bg-[#FFB6C1] text-red-800 text-xs sm:text-sm">
            <RotateCcw size={20}/> <span className="mt-1">Reset</span>
          </button>
        </div>
      </footer>

      {/* --- Modals --- */}

      {/* Edit Master Modal */}
      {showEditMasterModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-100 backdrop-blur-sm">
          <div className="bg-white rounded-3xl sm:rounded-4xl p-4 sm:p-6 w-full max-w-5xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200 shadow-2xl">
            <h2 className="text-2xl font-black mb-6 flex justify-between items-center text-slate-800 border-b pb-4">
              <span className="flex items-center gap-2"><Pencil className="text-orange-500"/> Edit Master List</span>
              <button onClick={handleAddEditableItem} className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-600 transition-colors shadow-lg shadow-green-200 flex items-center gap-2">
                <Box size={18}/> Add Product
              </button>
            </h2>
            
            <div className="grid grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4 py-2 font-black text-slate-400 text-xs uppercase tracking-wider min-w-[600px]">
              <div className="col-span-4">Product Name</div>
              <div className="col-span-1 text-center">Trays</div>
              <div className="col-span-2">Temp</div>
              <div className="col-span-2">Time (m)</div>
              <div className="col-span-2">Default Oven</div>
              <div className="col-span-1"></div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-auto pr-2 -mr-2 custom-scrollbar space-y-2">
              {editableQueue.map(item => (
                <div key={item.id} className="bg-slate-50 hover:bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-all grid grid-cols-12 gap-2 sm:gap-4 items-center shadow-sm group min-w-[600px]">
                  <input value={item.product} onChange={e => handleUpdateEditableItem(item.id, 'product', e.target.value)} className="col-span-4 p-2 rounded-lg border-transparent bg-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-slate-700 outline-none transition-all" placeholder="Product Name" />
                  <input type="number" value={item.quantity} onChange={e => handleUpdateEditableItem(item.id, 'quantity', parseInt(e.target.value) || 1)} className="col-span-1 p-2 rounded-lg border-transparent bg-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-slate-700 outline-none text-center transition-all" placeholder="Qty" />
                  <input value={item.temp} onChange={e => handleUpdateEditableItem(item.id, 'temp', e.target.value)} className="col-span-2 p-2 rounded-lg border-transparent bg-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-slate-700 outline-none transition-all" placeholder="Temp" />
                  <input type="number" value={item.totalTime} onChange={e => handleUpdateEditableItem(item.id, 'totalTime', parseFloat(e.target.value) || 10)} className="col-span-2 p-2 rounded-lg border-transparent bg-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-slate-700 outline-none transition-all" placeholder="Time" />
                  <select value={item.oven} onChange={e => handleUpdateEditableItem(item.id, 'oven', e.target.value)} className="col-span-2 p-2 rounded-lg border-transparent bg-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-bold text-slate-700 outline-none transition-all text-sm">
                    <optgroup label="Groups">
                      <option value="Group A">Group A</option>
                      <option value="Group B">Group B</option>
                      <option value="Group C">Group C</option>
                    </optgroup>
                    <optgroup label="Specific Ovens">
                      {OVENS.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                    </optgroup>
                  </select>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => handleDeleteEditableItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {editableQueue.length === 0 && (
                <div className="text-center py-20 text-gray-300 flex flex-col items-center justify-center h-full">
                  <Box size={48} className="opacity-20 mb-2"/>
                  <p className="text-sm uppercase font-bold tracking-widest">Master List is Empty</p>
                  <p className="text-xs text-gray-400 mt-2">Click 'Add New Product' to get started.</p>
                </div>
              )}
            </div>
            <div className="border-t pt-4 mt-4">
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowEditMasterModal(false)} className="flex-1 py-3 font-bold text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">Cancel</button>
                <button onClick={handleSaveMasterEdits} className="flex-auto bg-blue-600 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:brightness-110 transition-all">Exit & Save</button>
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
                {OVENS.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
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
        <div className="fixed inset-0 bg-blue-500/20 backdrop-blur-md flex items-center justify-center p-4 z-100">
          <div className="bg-white rounded-4xl p-8 w-full max-w-sm text-center shadow-2xl animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={32}/>
            </div>
            <h2 className="text-2xl font-black text-slate-800">Confirm Reset Progress</h2>
            <p className="text-gray-500 text-sm mt-2">This will move all items from Baking and Done back to the Queue. No items will be deleted.</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-3 font-bold text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleReset} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-blue-200">Confirm & Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* 恢復出廠彈窗 */}
      {showRecoverModal && (
        <div className="fixed inset-0 bg-red-500/20 backdrop-blur-md flex items-center justify-center p-4 z-100">
          <div className="bg-white rounded-4xl p-8 w-full max-w-sm text-center shadow-2xl animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <AlertTriangle size={32}/>
            </div>
            <h2 className="text-2xl font-black text-slate-800">Confirm Factory Reset</h2>
            <p className="text-gray-500 text-sm mt-2">This will delete all current data and restore the original preset list. This action cannot be undone.</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowRecoverModal(false)} className="flex-1 py-3 font-bold text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleRecover} className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-red-200">Confirm & Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* 嚴重超時警告彈窗 (Critical Alert) */}
      {overtimeAlertItem && (
        <div className="fixed inset-0 bg-red-900/80 backdrop-blur-md flex items-center justify-center p-4 z-110">
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

      {/* Start Baking Modal */}
      {startBakingInfo && (
        <StartBakingModal
            item={startBakingInfo.item}
            targetOven={startBakingInfo.targetOven}
            onConfirm={handleConfirmStartBaking}
            onClose={() => setStartBakingInfo(null)}
        />
      )}
    </div>
  );
}

const StartBakingModal = ({ item, targetOven, onConfirm, onClose }: { item: BakeryItem, targetOven?: string, onConfirm: (quantity: number) => void, onClose: () => void }) => {
    const [quantityStr, setQuantityStr] = useState('1');

    useEffect(() => {
        // Reset quantity to 1 when the item changes, but don't exceed the max available
        setQuantityStr(String(Math.min(1, item.quantity)));
    }, [item]);

    const handleNumpadClick = (value: number) => {
        setQuantityStr(prev => {
            const newStr = (prev === '0') ? String(value) : prev + value;
            const newNum = parseInt(newStr, 10);
            // Cap the value at the maximum available quantity
            return String(Math.min(item.quantity, newNum));
        });
    };

    const handleBackspace = () => {
        setQuantityStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    };

    const handleConfirm = () => {
        const quantityToBake = parseInt(quantityStr, 10) || 0;
        onConfirm(quantityToBake);
    };

    const numpadLayout = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-100">
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                <h2 className="text-2xl font-black mb-2 text-slate-800">Start Baking</h2>
                <p className="text-slate-600 font-bold text-lg mb-1">{item.product}</p>
                <p className="text-sm text-slate-400 mb-6">
                    {targetOven ? `To: ${targetOven}` : `Group: ${item.ovenGroup || item.oven}`}
                    <br/>
                    Remaining in queue: <span className="font-bold">{item.quantity}</span> trays
                </p>
                
                <div className="space-y-4">
                    <div className="w-full p-4 bg-slate-100 rounded-2xl font-bold text-center text-4xl text-blue-600 tracking-wider">
                        {quantityStr}
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                        {numpadLayout.map(num => <button key={num} onClick={() => handleNumpadClick(num)} className="py-4 bg-slate-50 rounded-2xl font-black text-2xl text-slate-700 hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-95">{num}</button>)}
                        <button onClick={() => handleNumpadClick(0)} className="py-4 bg-slate-50 rounded-2xl font-black text-2xl text-slate-700 hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-95 col-start-2">0</button>
                        <button onClick={handleBackspace} className="py-4 bg-slate-50 rounded-2xl font-black text-2xl text-slate-700 hover:bg-red-100 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center"><Delete size={24} /></button>
                    </div>
                    
                    <button onClick={handleConfirm} disabled={(parseInt(quantityStr, 10) || 0) <= 0} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black mt-4 hover:brightness-110 transition-all shadow-lg shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed">
                        Confirm & Start
                    </button>
                    <button onClick={onClose} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default App;
