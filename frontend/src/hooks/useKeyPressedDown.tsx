import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export const useKeyPressedDown = ({
  key,
  onKeyUp,
  onKeyDown,
}: {
  key: string;
  onKeyDown?: () => void;
  onKeyUp?: () => void;
}) => {
  const isPressedDown = useRef(false);
  useHotkeys(
    key,
    () => {
      if (!isPressedDown.current) {
        isPressedDown.current = true;
        onKeyDown?.();
      }
    },
    { keydown: true, keyup: false },
    [],
  );

  useHotkeys(
    key,
    () => {
      isPressedDown.current = false;
      onKeyUp?.();
    },
    { keydown: false, keyup: true },
    [],
  );

  return isPressedDown;
};
