'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="w-full">
      <nav className="h-20 px-4 md:px-6">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="https://kasar.io" className="flex items-center">
              <Image
                src="https://kasar.io/_next/image?url=%2F_next%2Fstatic%2Fmedia%2FkasarLogo.0513044c.png&w=640&q=75"
                alt="Logo"
                className="w-11 h-11 rounded-full"
                width={44}
                height={44}
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/about"
              className="text-gray-300 hover:text-white font-medium text-lg hover:scale-105 transition-all"
            >
              About
            </Link>
            <Link
              href="/docs"
              className="text-gray-300 hover:text-white font-medium text-lg hover:scale-105 transition-all"
            >
              Docs
            </Link>
            <a
              href="https://github.com/kasarlabs/snak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white font-medium text-lg hover:scale-105 transition-all"
            >
              GitHub
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 bg-neutral-900 border-b border-neutral-800 py-4 px-6 space-y-4">
            <Link
              href="/about"
              className="block text-gray-300 hover:text-white font-medium text-lg hover:bg-neutral-800 py-2 px-4 rounded-lg transition-all"
            >
              About
            </Link>
            <Link
              href="/docs"
              className="block text-gray-300 hover:text-white font-medium text-lg hover:bg-neutral-800 py-2 px-4 rounded-lg transition-all"
            >
              Docs
            </Link>
            <a
              href="https://github.com/kasarlabs/snak"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-gray-300 hover:text-white font-medium text-lg hover:bg-neutral-800 py-2 px-4 rounded-lg transition-all"
            >
              GitHub
            </a>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
