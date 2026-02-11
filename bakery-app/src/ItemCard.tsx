import { Play, CheckCircle, X } from 'lucide-react';
import { BakeryItem, ItemsState } from '../types';

// Helper function, can be moved to a utils file later
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface ItemCardProps {
  item: BakeryItem;
  category: keyof ItemsState;
  showBulkModal: boolean;
  bulkSelection: number[];
  onToggleBulkSelection: (id: number) => void;
  onStartBaking: (id: number) => void;
  onCompleteBaking: (id: number) => void;
  onRemoveItem: (id: number, category: keyof ItemsState) => void;
}

export const ItemCard = ({
  item,
  category,
  showBulkModal,
  bulkSelection,
  onToggleBulkSelection,
  onStartBaking,
  onCompleteBaking,
  onRemoveItem,
}: ItemCardProps) => {
  return (
    <div className={`bg-white rounded-2xl p-4 mb-3 shadow-sm border ${item.isOvertime ? 'border-red-500 animate-pulse' : 'border-slate-100'}`}>
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center flex-1">
          {category === 'queue' && showBulkModal && (
            <input 
              type="checkbox" 
              aria-label={`Select ${item.product} for bulk action`}
              title={`Select ${item.product} for bulk action`}
              checked={bulkSelection.includes(item.id)} 
              onChange={() => onToggleBulkSelection(item.id)} 
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
              <button onClick={() => onCompleteBaking(item.id)} className="bg-green-500 text-white rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 px-4 py-2 active:scale-95" title="Mark as Done" aria-label={`Mark ${item.product} as Done`}>
                <CheckCircle size={16}/>
                <span className="font-black text-sm">DONE</span>
              </button>
            )}
            
            {category === 'queue' && !showBulkModal && (
              <button onClick={() => onStartBaking(item.id)} className="bg-blue-700 text-white rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 px-4 py-2 active:scale-95" title="Start Baking" aria-label={`Start Baking ${item.product}`}>
                <Play size={16}/>
                <span className="font-black text-sm">START</span>
              </button>
            )}
            
            <button onClick={() => onRemoveItem(item.id, category)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title={`Remove ${item.product}`} aria-label={`Remove ${item.product}`}>
              <X size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};