import React,{useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ChevronLeft,ChevronRight,CalendarDays,Grid2X2,Clock,List,Plus,Search,Filter,X,Trash2,Sun,Moon,Download,Upload} from 'lucide-react';
import {EventManager} from './components/ui/event-manager';
createRoot(document.getElementById('root')!).render(<EventManager/>);
