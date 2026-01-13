import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const API_URL = 'https://work-1-ofufihusrrhczluf.prod-runtime.all-hands.dev/api'

const formatCurrency = (value) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
}

const debounce = (func, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

function App() {
  const [project, setProject] = useState(null)
  const [projects, setProjects] = useState([])
  const [archivedProjects, setArchivedProjects] = useState([])
  const [showBrowser, setShowBrowser] = useState(true) // Show on initial load
  const [browserTab, setBrowserTab] = useState('active')
  const [view, setView] = useState('calculation')
  const [draggedIndex, setDraggedIndex] = useState(null)
  const pendingUpdatesRef = useRef({})
  const saveTimeoutRef = useRef(null)

  // Load projects list
  const loadProjects = useCallback(async () => {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch(`${API_URL}/projects`),
        fetch(`${API_URL}/projects?archived=true`)
      ])
      setProjects(await activeRes.json())
      setArchivedProjects(await archivedRes.json())
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }, [])

  // Load single project
  const loadProject = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_URL}/projects/${id}`)
      const data = await res.json()
      setProject(data)
      setShowBrowser(false)
    } catch (err) {
      console.error('Failed to load project:', err)
    }
  }, [])

  // Create new project
  const createProject = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Neues Projekt' })
      })
      const data = await res.json()
      setProject(data)
      setShowBrowser(false)
      loadProjects()
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  // Save project with longer debounce
  const saveProjectDebounced = useCallback((updates) => {
    if (!project) return
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
      } catch (err) {
        console.error('Failed to save project:', err)
      }
    }, 1500) // Increased debounce to 1.5 seconds
  }, [project])

  // Update project field (local only, save debounced)
  const updateProjectField = (field, value) => {
    setProject(prev => ({ ...prev, [field]: value }))
    saveProjectDebounced({ [field]: value })
  }

  // Archive/Unarchive project
  const toggleArchive = async (proj, archived) => {
    try {
      await fetch(`${API_URL}/projects/${proj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      })
      loadProjects()
      if (project?.id === proj.id) {
        setProject(null)
      }
    } catch (err) {
      console.error('Failed to archive project:', err)
    }
  }

  // Delete project
  const deleteProject = async (proj) => {
    if (!confirm(`Projekt "${proj.name}" wirklich löschen?`)) return
    try {
      await fetch(`${API_URL}/projects/${proj.id}`, { method: 'DELETE' })
      loadProjects()
      if (project?.id === proj.id) {
        setProject(null)
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  // Add position
  const addPosition = async (type) => {
    if (!project) return
    try {
      const res = await fetch(`${API_URL}/projects/${project.id}/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      const position = await res.json()
      setProject(prev => ({
        ...prev,
        positions: [...(prev.positions || []), position]
      }))
    } catch (err) {
      console.error('Failed to add position:', err)
    }
  }

  // Update position with batched debounce
  const updatePositionDebounced = useCallback((positionId, updates) => {
    // Merge updates for this position
    pendingUpdatesRef.current[positionId] = {
      ...pendingUpdatesRef.current[positionId],
      ...updates
    }
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const pending = { ...pendingUpdatesRef.current }
      pendingUpdatesRef.current = {}
      
      for (const [id, upd] of Object.entries(pending)) {
        try {
          await fetch(`${API_URL}/positions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(upd)
          })
        } catch (err) {
          console.error('Failed to update position:', err)
        }
      }
    }, 1500) // Increased debounce to 1.5 seconds
  }, [])

  // Update position locally and debounce save
  const updatePositionLocal = (positionId, updates) => {
    setProject(prev => ({
      ...prev,
      positions: prev.positions.map(p => 
        p.id === positionId ? { ...p, ...updates } : p
      )
    }))
    updatePositionDebounced(positionId, updates)
  }

  // Update position immediately (for toggle)
  const updatePositionImmediate = async (positionId, updates) => {
    setProject(prev => ({
      ...prev,
      positions: prev.positions.map(p => 
        p.id === positionId ? { ...p, ...updates } : p
      )
    }))
    try {
      await fetch(`${API_URL}/positions/${positionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
    } catch (err) {
      console.error('Failed to update position:', err)
    }
  }

  // Delete position
  const deletePosition = async (positionId) => {
    try {
      await fetch(`${API_URL}/positions/${positionId}`, { method: 'DELETE' })
      setProject(prev => ({
        ...prev,
        positions: prev.positions.filter(p => p.id !== positionId)
      }))
    } catch (err) {
      console.error('Failed to delete position:', err)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    setProject(prev => {
      const newPositions = [...prev.positions]
      const [draggedItem] = newPositions.splice(draggedIndex, 1)
      newPositions.splice(index, 0, draggedItem)
      return { ...prev, positions: newPositions }
    })
    setDraggedIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedIndex === null || !project) return
    
    try {
      await fetch(`${API_URL}/projects/${project.id}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: project.positions })
      })
    } catch (err) {
      console.error('Failed to reorder positions:', err)
    }
    setDraggedIndex(null)
  }

  // Calculate position sum - always include hotel
  const calculatePositionSum = (position) => {
    if (!project || !position.active) return 0
    
    const daysOnSet = position.days_on_set ?? project.shooting_days
    
    if (position.type === 'crew' || position.type === 'darsteller') {
      const dailyTotal = (position.daily_rate || 0) * daysOnSet
      const hotelTotal = (position.hotel_nights || 0) * (project.hotel_cost_per_night || 0)
      const perDiemTotal = (project.per_diem || 0) * daysOnSet
      return dailyTotal + (position.flat_fee || 0) + hotelTotal + (position.travel_costs || 0) + perDiemTotal
    } else {
      return position.costs || 0
    }
  }

  // Calculate summaries - updated for crew and darsteller
  const calculateSummaries = () => {
    if (!project?.positions) return { crew: 0, darsteller: 0, hotel: 0, travel: 0, leihe: 0, location: 0, sonstiges: 0, total: 0 }
    
    const activePositions = project.positions.filter(p => p.active)
    
    let crew = 0, darsteller = 0, hotel = 0, travel = 0, leihe = 0, location = 0, sonstiges = 0
    
    activePositions.forEach(p => {
      const daysOnSet = p.days_on_set ?? project.shooting_days
      
      if (p.type === 'crew') {
        crew += (p.daily_rate || 0) * daysOnSet + (p.flat_fee || 0) + (project.per_diem || 0) * daysOnSet
        hotel += (p.hotel_nights || 0) * (project.hotel_cost_per_night || 0)
        travel += p.travel_costs || 0
      } else if (p.type === 'darsteller') {
        darsteller += (p.daily_rate || 0) * daysOnSet + (p.flat_fee || 0) + (project.per_diem || 0) * daysOnSet
        hotel += (p.hotel_nights || 0) * (project.hotel_cost_per_night || 0)
        travel += p.travel_costs || 0
      } else if (p.type === 'leihe') {
        leihe += p.costs || 0
      } else if (p.type === 'location') {
        location += p.costs || 0
      } else if (p.type === 'sonstiges') {
        sonstiges += p.costs || 0
      }
    })
    
    return { crew, darsteller, hotel, travel, leihe, location, sonstiges, total: crew + darsteller + hotel + travel + leihe + location + sonstiges }
  }

  // Calculate hotel nights - always on
  const calculateHotelNights = () => {
    if (!project?.positions) return 0
    return project.positions
      .filter(p => p.active && (p.type === 'crew' || p.type === 'darsteller'))
      .reduce((sum, p) => sum + (p.hotel_nights || 0), 0)
  }

  // Calculate real costs comparison
  const calculateComparison = () => {
    if (!project?.positions) return { calculated: 0, actual: 0, difference: 0 }
    
    const calculated = project.positions
      .filter(p => p.active)
      .reduce((sum, p) => sum + calculatePositionSum(p), 0)
    
    const actual = project.positions
      .filter(p => p.active)
      .reduce((sum, p) => sum + (p.actual_costs || 0), 0)
    
    return { calculated, actual, difference: calculated - actual }
  }

  // Load projects on initial load
  useEffect(() => {
    loadProjects()
  }, [])

  const summaries = calculateSummaries()
  const comparison = calculateComparison()

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>Film Budget Kalkulator</h1>
        </div>
        <div className="header-actions">
          <button onClick={() => { loadProjects(); setShowBrowser(true) }}>Projekte</button>
        </div>
      </header>

      <main className="main-content">
        {!project ? (
          <div className="empty-state">
            <p>Kein Projekt geladen</p>
            <button onClick={() => { loadProjects(); setShowBrowser(true) }}>
              Projekte öffnen
            </button>
          </div>
        ) : (
          <>
            {/* View Toggle */}
            <div className="view-toggle">
              <button 
                className={view === 'calculation' ? 'active' : ''} 
                onClick={() => setView('calculation')}
              >
                Kalkulation
              </button>
              <button 
                className={view === 'comparison' ? 'active' : ''} 
                onClick={() => setView('comparison')}
              >
                Realkosten-Vergleich
              </button>
            </div>

            {view === 'calculation' ? (
              <>
                {/* Project Settings */}
                <div className="project-settings">
                  <input
                    type="text"
                    className="project-name-input"
                    value={project.name || ''}
                    onChange={(e) => updateProjectField('name', e.target.value)}
                    placeholder="Projektname"
                  />
                  <div className="settings-grid">
                    <div className="setting-item">
                      <label>Drehtage</label>
                      <input
                        type="number"
                        className="with-spinner"
                        min="1"
                        step="1"
                        value={project.shooting_days || ''}
                        onChange={(e) => updateProjectField('shooting_days', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="setting-item">
                      <label>Hotelkosten pro Nacht (€)</label>
                      <input
                        type="text"
                        className="no-spinner"
                        value={project.hotel_cost_per_night || 0}
                        onChange={(e) => updateProjectField('hotel_cost_per_night', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="setting-item">
                      <label>Verpflegungspauschale pro Person/Tag (€)</label>
                      <input
                        type="text"
                        className="no-spinner"
                        value={project.per_diem || 0}
                        onChange={(e) => updateProjectField('per_diem', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation List */}
                <div className="calculation-section">
                  <div className="section-header">
                    <h2>Kalkulationsliste</h2>
                    <div className="add-buttons">
                      <button onClick={() => addPosition('crew')}>+ Crew</button>
                      <button onClick={() => addPosition('darsteller')}>+ Darsteller</button>
                      <button onClick={() => addPosition('leihe')}>+ Leihe</button>
                      <button onClick={() => addPosition('location')}>+ Location</button>
                      <button onClick={() => addPosition('sonstiges')}>+ Sonstiges</button>
                    </div>
                  </div>
                  
                  {project.positions?.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="calculation-table">
                        <thead>
                          <tr>
                            <th style={{ width: 30 }}></th>
                            <th style={{ width: 40 }}></th>
                            <th style={{ width: 90 }}>Typ</th>
                            <th>Name</th>
                            <th style={{ width: 100 }}>Tagesgage</th>
                            <th style={{ width: 100 }}>Pauschale</th>
                            <th style={{ width: 80 }}>Hotelnächte</th>
                            <th style={{ width: 100 }}>Fahrtkosten</th>
                            <th style={{ width: 80 }}>Tage am Set</th>
                            <th style={{ width: 30 }}>Farbe</th>
                            <th style={{ width: 120 }}>Summe</th>
                            <th style={{ width: 40 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.positions.map((pos, index) => (
                            <PositionRow
                              key={pos.id}
                              position={pos}
                              project={project}
                              index={index}
                              onUpdate={(updates) => updatePositionLocal(pos.id, updates)}
                              onToggle={() => updatePositionImmediate(pos.id, { active: !pos.active })}
                              onDelete={() => deletePosition(pos.id)}
                              calculateSum={() => calculatePositionSum(pos)}
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>Noch keine Positionen vorhanden</p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="summary-section">
                  <h2>Auswertung</h2>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <label>Crew-Kosten</label>
                      <div className="value">{formatCurrency(summaries.crew)}</div>
                    </div>
                    <div className="summary-item">
                      <label>Darsteller-Kosten</label>
                      <div className="value">{formatCurrency(summaries.darsteller)}</div>
                    </div>
                    <div className="summary-item">
                      <label>Hotelkosten</label>
                      <div className="value">{formatCurrency(summaries.hotel)}</div>
                    </div>
                    <div className="summary-item">
                      <label>Anfahrtskosten</label>
                      <div className="value">{formatCurrency(summaries.travel)}</div>
                    </div>
                    <div className="summary-item">
                      <label>Leihe-Kosten</label>
                      <div className="value">{formatCurrency(summaries.leihe)}</div>
                    </div>
                    <div className="summary-item">
                      <label>Location-Kosten</label>
                      <div className="value">{formatCurrency(summaries.location)}</div>
                    </div>
                    <div className="summary-item">
                      <label>Sonstiges-Kosten</label>
                      <div className="value">{formatCurrency(summaries.sonstiges)}</div>
                    </div>
                  </div>
                  <div className="total-row">
                    <label>Gesamtpreis</label>
                    <div className="value">{formatCurrency(summaries.total)}</div>
                  </div>
                </div>
              </>
            ) : (
              /* Real Cost Comparison View */
              <div className="calculation-section">
                <div className="section-header">
                  <h2>Realkosten-Vergleich</h2>
                </div>
                
                {project.positions?.length > 0 ? (
                  (() => {
                    // Calculate per diem for each position and total
                    const perDiem = project.per_diem || 0
                    const activePositions = project.positions.filter(p => p.active)
                    const crewDarstellerPositions = activePositions.filter(p => p.type === 'crew' || p.type === 'darsteller')
                    
                    // Calculate total per diem
                    let totalPerDiem = 0
                    crewDarstellerPositions.forEach(pos => {
                      const daysOnSet = pos.days_on_set ?? project.shooting_days
                      totalPerDiem += perDiem * daysOnSet
                    })
                    
                    // Calculate position costs WITHOUT per diem
                    const getPositionCostWithoutPerDiem = (pos) => {
                      if (pos.type === 'leihe' || pos.type === 'location' || pos.type === 'sonstiges') {
                        return pos.costs || 0
                      }
                      const daysOnSet = pos.days_on_set ?? project.shooting_days
                      const dailyRate = (pos.daily_rate || 0) * daysOnSet
                      const flatFee = pos.flat_fee || 0
                      const hotelCosts = (pos.hotel_nights || 0) * (project.hotel_cost_per_night || 0)
                      const travelCosts = pos.travel_costs || 0
                      // Exclude per diem from individual position
                      return dailyRate + flatFee + hotelCosts + travelCosts
                    }
                    
                    // Calculate totals
                    let totalCalculated = 0
                    activePositions.forEach(pos => {
                      totalCalculated += getPositionCostWithoutPerDiem(pos)
                    })
                    totalCalculated += totalPerDiem // Add total per diem once
                    
                    let totalActual = (project.actual_per_diem || 0)
                    activePositions.forEach(pos => {
                      totalActual += (pos.actual_costs || 0)
                    })
                    
                    return (
                      <>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="comparison-table">
                            <thead>
                              <tr>
                                <th>Typ</th>
                                <th>Name</th>
                                <th>Kalkulierte Kosten</th>
                                <th>Tatsächliche Kosten</th>
                                <th>Differenz</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activePositions.map((pos) => {
                                const calculated = getPositionCostWithoutPerDiem(pos)
                                const actual = pos.actual_costs || 0
                                const diff = calculated - actual
                                return (
                                  <tr key={pos.id}>
                                    <td>
                                      <span className={`type-badge ${pos.type}`}>
                                        {pos.type === 'crew' ? 'Crew' : 
                                         pos.type === 'darsteller' ? 'Darsteller' :
                                         pos.type === 'leihe' ? 'Leihe' :
                                         pos.type === 'location' ? 'Location' : 'Sonstiges'}
                                      </span>
                                    </td>
                                    <td>{pos.name || '(ohne Name)'}</td>
                                    <td className="calculated">{formatCurrency(calculated)}</td>
                                    <td>
                                      <input
                                        type="text"
                                        className="actual-input no-spinner"
                                        value={pos.actual_costs || ''}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0
                                          updatePositionLocal(pos.id, { actual_costs: value })
                                        }}
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className={`difference ${diff >= 0 ? 'positive' : 'negative'}`}>
                                      {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                                    </td>
                                  </tr>
                                )
                              })}
                              {/* Verpflegungen row */}
                              {totalPerDiem > 0 && (
                                <tr className="per-diem-row">
                                  <td>
                                    <span className="type-badge verpflegung">Verpflegung</span>
                                  </td>
                                  <td>Verpflegungen gesamt</td>
                                  <td className="calculated">{formatCurrency(totalPerDiem)}</td>
                                  <td>
                                    <input
                                      type="text"
                                      className="actual-input no-spinner"
                                      value={project.actual_per_diem || ''}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0
                                        updateProjectField('actual_per_diem', value)
                                      }}
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className={`difference ${(totalPerDiem - (project.actual_per_diem || 0)) >= 0 ? 'positive' : 'negative'}`}>
                                    {(totalPerDiem - (project.actual_per_diem || 0)) >= 0 ? '+' : ''}{formatCurrency(totalPerDiem - (project.actual_per_diem || 0))}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        
                        <div className="comparison-summary">
                          <div className="comparison-summary-grid">
                            <div className="comparison-summary-item">
                              <label>Kalkulierte Gesamtkosten</label>
                              <div className="value">{formatCurrency(totalCalculated)}</div>
                            </div>
                            <div className="comparison-summary-item">
                              <label>Tatsächliche Gesamtkosten</label>
                              <div className="value">{formatCurrency(totalActual)}</div>
                            </div>
                            <div className="comparison-summary-item">
                              <label>Differenz</label>
                              <div className={`value ${(totalCalculated - totalActual) >= 0 ? 'positive' : 'negative'}`}>
                                {(totalCalculated - totalActual) >= 0 ? '+' : ''}{formatCurrency(totalCalculated - totalActual)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )
                  })()
                ) : (
                  <div className="empty-state">
                    <p>Noch keine Positionen vorhanden</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Project Browser Modal */}
      {showBrowser && (
        <div className="modal-overlay" onClick={() => setShowBrowser(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Projekte</h2>
              <div className="modal-header-actions">
                <button className="new-project-btn" onClick={createProject}>+ Neues Projekt</button>
                <button className="modal-close" onClick={() => setShowBrowser(false)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-tabs">
                <button 
                  className={browserTab === 'active' ? 'active' : ''} 
                  onClick={() => setBrowserTab('active')}
                >
                  Aktiv ({projects.length})
                </button>
                <button 
                  className={browserTab === 'archived' ? 'active' : ''} 
                  onClick={() => setBrowserTab('archived')}
                >
                  Archiv ({archivedProjects.length})
                </button>
              </div>
              
              <div className="project-list">
                {(browserTab === 'active' ? projects : archivedProjects).map((proj) => (
                  <div key={proj.id} className="project-item">
                    <div onClick={() => loadProject(proj.id)}>
                      <div className="project-item-name">{proj.name}</div>
                      <div className="project-item-date">
                        {new Date(proj.updated_at).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <div className="project-item-actions">
                      <button onClick={() => loadProject(proj.id)}>Laden</button>
                      {browserTab === 'active' ? (
                        <button onClick={() => toggleArchive(proj, true)}>Archivieren</button>
                      ) : (
                        <button onClick={() => toggleArchive(proj, false)}>Wiederherstellen</button>
                      )}
                      <button className="delete-btn" onClick={() => deleteProject(proj)}>Löschen</button>
                    </div>
                  </div>
                ))}
                {(browserTab === 'active' ? projects : archivedProjects).length === 0 && (
                  <div className="empty-state">
                    <p>{browserTab === 'active' ? 'Keine aktiven Projekte' : 'Keine archivierten Projekte'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Color presets
const COLOR_PRESETS = [
  '#ffffff', // white/none
  '#ffcdd2', // red
  '#f8bbd9', // pink
  '#e1bee7', // purple
  '#c5cae9', // indigo
  '#bbdefb', // blue
  '#b2ebf2', // cyan
  '#c8e6c9', // green
  '#dcedc8', // light green
  '#fff9c4', // yellow
  '#ffe0b2', // orange
  '#d7ccc8', // brown
  '#cfd8dc', // grey
]

// Color Picker Component
function ColorPicker({ color, onChange }) {
  const [showPicker, setShowPicker] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  
  const handleClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.top - 110, // Position above the button
        left: rect.left - 50
      })
    }
    setShowPicker(!showPicker)
  }
  
  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])
  
  return (
    <div className="color-picker-wrapper" ref={buttonRef}>
      <button 
        className="color-btn"
        style={{ backgroundColor: color || '#ffffff' }}
        onClick={handleClick}
        title="Farbe wählen"
      />
      {showPicker && (
        <div 
          className="color-dropdown"
          style={{ top: position.top, left: position.left }}
        >
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              className={`color-option ${color === c || (!color && c === '#ffffff') ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c === '#ffffff' ? null : c)
                setShowPicker(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Position Row Component
function PositionRow({ position, project, index, onUpdate, onToggle, onDelete, calculateSum, onDragStart, onDragOver, onDragEnd }) {
  const isSimpleType = ['leihe', 'location', 'sonstiges'].includes(position.type)
  
  return (
    <tr 
      className={!position.active ? 'row-inactive' : ''} 
      style={position.color ? { backgroundColor: position.color } : {}}
      onDragOver={onDragOver}
    >
      <td 
        className="drag-handle" 
        title="Ziehen zum Sortieren"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >⋮⋮</td>
      <td>
        <button 
          className={`toggle-btn ${position.active ? 'active' : 'inactive'}`}
          onClick={onToggle}
          title={position.active ? 'Deaktivieren' : 'Aktivieren'}
        >
          {position.active ? '✓' : '○'}
        </button>
      </td>
      <td>
        <span className={`type-badge ${position.type}`}>
          {position.type === 'crew' ? 'Crew' : 
           position.type === 'darsteller' ? 'Darsteller' :
           position.type === 'leihe' ? 'Leihe' :
           position.type === 'location' ? 'Location' : 'Sonstiges'}
        </span>
      </td>
      <td>
        <input
          type="text"
          className="name-input"
          value={position.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Name"
        />
      </td>
      {isSimpleType ? (
        <>
          <td></td>
          <td>
            <input
              type="text"
              className="no-spinner"
              value={position.costs || ''}
              onChange={(e) => onUpdate({ costs: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </td>
          <td></td>
          <td></td>
          <td></td>
        </>
      ) : (
        <>
          <td>
            <input
              type="text"
              className="no-spinner"
              value={position.daily_rate || ''}
              onChange={(e) => onUpdate({ daily_rate: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </td>
          <td>
            <input
              type="text"
              className="no-spinner"
              value={position.flat_fee || ''}
              onChange={(e) => onUpdate({ flat_fee: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </td>
          <td>
            <input
              type="number"
              className="with-spinner"
              min="0"
              step="1"
              value={position.hotel_nights || 0}
              onChange={(e) => onUpdate({ hotel_nights: parseInt(e.target.value) || 0 })}
            />
          </td>
          <td>
            <input
              type="text"
              className="no-spinner"
              value={position.travel_costs || ''}
              onChange={(e) => onUpdate({ travel_costs: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </td>
          <td>
            <input
              type="number"
              className="with-spinner"
              min="1"
              step="1"
              value={position.days_on_set ?? project.shooting_days}
              onChange={(e) => onUpdate({ days_on_set: parseInt(e.target.value) || project.shooting_days })}
            />
          </td>
        </>
      )}
      <td className="color-cell">
        <ColorPicker 
          color={position.color} 
          onChange={(color) => onUpdate({ color })}
        />
      </td>
      <td className="sum-cell">
        {formatCurrency(calculateSum())}
      </td>
      <td>
        <button className="delete-btn" onClick={onDelete} title="Löschen">🗑</button>
      </td>
    </tr>
  )
}

export default App
