import React from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, BookOpen, Sparkles, List, Bot, RefreshCw, Key, CheckCircle2, Target, AlertTriangle, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export type UserRole = 'Admin' | 'Center' | 'Teacher' | 'Parent';

interface HeaderProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  activeAgent: 'Gemini' | 'FreeAgent';
  isGeminiExhausted: boolean;
  resetGemini: () => void;
  onOpenApiManager: () => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
}

export default function Header({ 
  isMenuOpen, 
  setIsMenuOpen, 
  activeAgent, 
  isGeminiExhausted, 
  resetGemini,
  onOpenApiManager,
  activeRole,
  setActiveRole
}: HeaderProps) {
  const roles: UserRole[] = ['Admin', 'Center', 'Teacher', 'Parent'];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center space-x-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 hidden lg:block font-sans tracking-tight">EduFlow AI</span>
            </NavLink>

            {/* Role Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as UserRole)}
                className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
              >
                {roles.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center space-x-1">
            <NavLink to="/books" className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center space-x-1.5">
                <List className="h-4 w-4" />
                <span>Library</span>
              </div>
            </NavLink>
            <NavLink to="/lesson-plans" className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center space-x-1.5">
                <BookOpen className="h-4 w-4" />
                <span>Saved Plans</span>
              </div>
            </NavLink>
            <NavLink to="/generator" className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="h-4 w-4" />
                <span>Generator</span>
              </div>
            </NavLink>
            <NavLink to="/grading" className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Grading</span>
              </div>
            </NavLink>
            <NavLink to="/personalized" className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center space-x-1.5">
                <Target className="h-4 w-4" />
                <span>Learning</span>
              </div>
            </NavLink>
            <NavLink to="/warning-system" className={({ isActive }) => cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
              <div className="flex items-center space-x-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>Warnings</span>
              </div>
            </NavLink>
            
            <div className="h-4 w-px bg-gray-200 mx-2" />

            {/* Keys Button */}
            <button 
              onClick={onOpenApiManager}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              title="Manage API Keys"
            >
              <Key className="h-5 w-5" />
            </button>

            {/* Supervisor Status Indicator */}
            <div className="ml-2 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
              <Bot className={cn("h-4 w-4", activeAgent === 'Gemini' ? "text-blue-600" : "text-orange-600")} />
              <span className="text-xs font-medium text-gray-700">
                <span className={activeAgent === 'Gemini' ? "text-blue-600" : "text-orange-600"}>{activeAgent}</span>
              </span>
              {isGeminiExhausted && (
                <button 
                  onClick={resetGemini}
                  className="ml-1 p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                  title="Reset Gemini Status"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
            </div>
          </nav>

          {/* Table/Smaller Desktop Toggle */}
          <div className="xl:hidden flex items-center gap-3">
             <button onClick={onOpenApiManager} className="p-2 text-gray-500"><Key className="h-5 w-5" /></button>
             <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="xl:hidden bg-white border-b border-gray-200 px-2 pt-2 pb-3 space-y-1">
          <NavLink to="/books" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => cn("block px-3 py-2 rounded-md text-base font-medium", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
            Library
          </NavLink>
          <NavLink to="/lesson-plans" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => cn("block px-3 py-2 rounded-md text-base font-medium", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
            Saved Plans
          </NavLink>
          <NavLink to="/generator" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => cn("block px-3 py-2 rounded-md text-base font-medium", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
            Generator
          </NavLink>
          <NavLink to="/grading" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => cn("block px-3 py-2 rounded-md text-base font-medium", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
            Grading
          </NavLink>
          <NavLink to="/personalized" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => cn("block px-3 py-2 rounded-md text-base font-medium", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
            Personalized Paths
          </NavLink>
          <NavLink to="/warning-system" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => cn("block px-3 py-2 rounded-md text-base font-medium", isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
            Warning System
          </NavLink>
        </div>
      )}
    </header>
  );
}
