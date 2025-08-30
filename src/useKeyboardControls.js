
import { useEffect, useState } from 'react';

const keyActionMap = {
  w: 'forward',
  s: 'backward',
  a: 'left',
  d: 'right',
  e: 'e',
};

export const useKeyboardControls = () => {
  const [controls, setControls] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    shift: false,
    log: false, // Add log state
    e: false,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'shift') setControls((c) => ({ ...c, shift: true }));
      if (key === 'c') setControls((c) => ({ ...c, log: true }));
      const action = keyActionMap[key];
      if (action) setControls((c) => ({ ...c, [action]: true }));
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'shift') setControls((c) => ({ ...c, shift: false }));
      if (key === 'c') setControls((c) => ({ ...c, log: false }));
      const action = keyActionMap[key];
      if (action) setControls((c) => ({ ...c, [action]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return controls;
};
