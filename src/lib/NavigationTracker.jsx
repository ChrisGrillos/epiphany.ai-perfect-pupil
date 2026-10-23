import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
export default function NavigationTracker() {
  const location = useLocation();
  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({ page: location.pathname, text: document.querySelector('main')?.innerText.slice(0, 6000) || document.body.innerText.slice(0, 6000), coordinate_system: 'UI coordinates: origin top-left; x right, y down' });
    return () => { delete window.render_game_to_text; };
  }, [location.pathname]);
  return null;
}
