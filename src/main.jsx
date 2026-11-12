import React from 'react'
import { createRoot } from 'react-dom/client'
import Site from './Site'
import Admin from './Admin'
import './index.css'
const isAdmin = window.location.pathname.startsWith('/admin')
createRoot(document.getElementById('root')).render(isAdmin ? <Admin /> : <Site />)
