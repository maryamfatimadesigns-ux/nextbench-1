import React from 'react';


export default function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-surface-base z-[9999]">
      <div className="w-12 h-12 border-4 border-brand-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

