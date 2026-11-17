/** 极简全局提示：皮肤内部只有「已收藏 / 已追更」这类一次性反馈，用事件即可，不引状态库。 */
import { useEffect, useState } from "react";

type Listener = (text: string) => void;
const listeners = new Set<Listener>();

export function toast(text: string) {
  for (const listener of listeners) listener(text);
}

export function Toaster() {
  const [items, setItems] = useState<Array<{ id: number; text: string }>>([]);
  useEffect(() => {
    let seq = 0;
    const listener: Listener = (text) => {
      const id = ++seq;
      setItems((list) => [...list, { id, text }]);
      window.setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 2200);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((item) => <div className="toast" key={item.id}>{item.text}</div>)}
    </div>
  );
}
