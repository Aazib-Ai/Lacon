import React from 'react'
import { ModernEditor } from './ModernEditor'

export function ModernEditorDemo() {
  const handleChange = (content: any) => {
    console.log('Content changed:', content)
  }

  return (
    <div className="w-full h-screen">
      <ModernEditor onChange={handleChange} />
    </div>
  )
}
