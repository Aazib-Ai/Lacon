import React, { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Minus,
  Plus,
  Sparkles,
  ArrowUp,
  List,
  ListOrdered,
  CheckSquare,
  Heading,
} from 'lucide-react'
import { cn } from '@/renderer/lib/utils'
import { Button } from './ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/Tooltip'

interface ModernEditorProps {
  content?: any
  onChange?: (content: any) => void
}

export function ModernEditor({ content, onChange }: ModernEditorProps) {
  const [zoom, setZoom] = useState(100)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: content || {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Welcome to Your AI Editor' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Start typing or use the AI toolkit to create amazing content...',
            },
          ],
        },
      ],
    },
    onUpdate: ({ editor }: { editor: any }) => {
      onChange?.(editor.getJSON())
    },
  })

  if (!editor) {
    return null
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    icon: Icon,
    tooltip,
  }: {
    onClick: () => void
    isActive?: boolean
    icon: React.ElementType
    tooltip: string
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            'h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900',
            isActive && 'bg-slate-200 text-slate-900'
          )}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-[#F9FAFB]">
        {/* Top Toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2">
            {/* Left: AI Toolkit Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  className="rounded-full bg-gray-900 hover:bg-gray-800"
                >
                  AI Toolkit examples
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Generate outline</DropdownMenuItem>
                <DropdownMenuItem>Improve writing</DropdownMenuItem>
                <DropdownMenuItem>Fix grammar</DropdownMenuItem>
                <DropdownMenuItem>Make shorter</DropdownMenuItem>
                <DropdownMenuItem>Make longer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-gray-300" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                title="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[3rem] text-center">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                title="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* Headings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  title="Headings"
                >
                  <Heading className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                >
                  Heading 1
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                >
                  Heading 2
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                >
                  Heading 3
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    editor.chain().focus().setParagraph().run()
                  }
                >
                  Normal Text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Lists Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  title="Lists"
                >
                  <List className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-4 w-4 mr-2" />
                  Bullet List
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Ordered List
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Task List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-gray-300" />

            {/* Formatting Buttons */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              icon={Bold}
              tooltip="Bold"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              icon={Italic}
              tooltip="Italic"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              icon={Strikethrough}
              tooltip="Strikethrough"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              icon={UnderlineIcon}
              tooltip="Underline"
            />
            
            {/* Highlight Color Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    'h-8 w-8 text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                    editor.isActive('highlight') && 'bg-slate-200 text-slate-900'
                  )}
                  title="Highlight colors"
                >
                  <Highlighter className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fef08a' }} />
                  Yellow
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#86efac' }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#86efac' }} />
                  Green
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#93c5fd' }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#93c5fd' }} />
                  Blue
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#fda4af' }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fda4af' }} />
                  Pink
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#c4b5fd' }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#c4b5fd' }} />
                  Purple
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#fdba74' }).run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fdba74' }} />
                  Orange
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().unsetHighlight().run()}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 rounded border border-slate-300" />
                  Remove Highlight
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-6 bg-gray-300" />

            {/* Alignment Buttons */}
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
              icon={AlignLeft}
              tooltip="Align left"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
              icon={AlignCenter}
              tooltip="Align center"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
              icon={AlignRight}
              tooltip="Align right"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              isActive={editor.isActive({ textAlign: 'justify' })}
              icon={AlignJustify}
              tooltip="Justify"
            />

            <div className="flex-1" />

            {/* Right: Custom Component Button */}
            <Button variant="ghost" className="text-sm">
              + Custom component
            </Button>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto py-8">
          <div className="max-w-[850px] mx-auto px-8 relative">
            {/* Document Page */}
            <div
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 min-h-[1056px] relative"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            >
              <EditorContent editor={editor} className="prose prose-lg max-w-none" />
              
              {/* Comment Bubble Example */}
              <div className="absolute -right-12 top-20">
                <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium shadow-lg">
                  2
                </div>
              </div>
            </div>

            {/* Page Break / Next Page Indicator */}
            <div className="h-8" />
          </div>
        </div>

        {/* Floating AI Input */}
        <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-white rounded-full shadow-lg border border-gray-200 px-6 py-3 flex items-center gap-3 min-w-[600px]">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <input
              type="text"
              placeholder="Tell AI what else needs to be changed..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
            />
            <Button size="icon" className="rounded-full h-8 w-8 bg-gray-900 hover:bg-gray-800">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
