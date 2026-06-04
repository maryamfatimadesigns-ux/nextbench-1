import React from 'react';

export default function CenterLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-32">
      <div className="w-10 h-10 border-3 border-brand-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
