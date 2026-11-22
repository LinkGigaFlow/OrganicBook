import { useEffect } from 'react';
import { useToast } from './toast-store';
export function Toast() {
  const { message, seq } = useToast();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => useToast.setState({ message: null }), 4200);
    return () => clearTimeout(t);
  }, [message, seq]);
  return (
    <div id="toast" role="status" className={message ? 'show' : ''}>
      {message}
    </div>
  );
}
