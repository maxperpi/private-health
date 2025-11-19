"use client";

import React, { useRef } from "react";
import { RainbowKitCustomConnectButton } from "~~/components/helper";
import { useOutsideClick } from "~~/hooks/helper";

/**
 * Site header
 */
export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar min-h-0 shrink-0 justify-between z-20 px-0 sm:px-2">
      <div className="flex items-center justify-between w-full max-w-[1024px] mx-auto px-4 pt-5">
        <img src="/health-hero.png" alt="Health Hero" className="w-30 opacity-70" />
        <div className="flex">
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </div>
  );
};
