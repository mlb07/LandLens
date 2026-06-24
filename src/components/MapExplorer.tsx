import { useEffect, useRef, useState } from 'react'
import { Layers, LoaderCircle, LocateFixed, MapPin, ScanLine, Search, X } from 'lucide-react'
import L from 'leaflet'
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { findStateForPoint, getStateDefinition, getStateFeature, isPointInState } from '../data/states'
import type { Coordinates, ParcelSelection } from '../types/site'

const markerIcon = L.divIcon({
  className: 'landlens-marker-wrap',
  html: '<div class="landlens-marker"><span></span></div>',
  iconSize: [38, 46], iconAnchor: [19, 43],
})

interface SearchResult {
  display_name: string
  lat: string
  lon: string
}

type SelectLocation = (coordinates: Coordinates, stateCode: string) => void

function MapEvents({ onSelect }: { onSelect: SelectLocation }) {
  useMapEvents({
    click(event) {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng }
      const state = findStateForPoint(point)
      if (state) onSelect(point, state.code)
    },
  })
  return null
}

function StateViewport({ stateCode }: { stateCode: string }) {
  const map = useMap()
  const state = getStateDefinition(stateCode)

  useEffect(() => {
    if (stateCode === 'AK') {
      map.setView([63.5, -152], 4, { animate: false })
      return
    }
    const bounds = L.geoJSON(getStateFeature(stateCode)).getBounds()
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: state.maxFitZoom ?? 7, animate: false })
  }, [map, state.maxFitZoom, stateCode])

  return null
}

function MapReliability() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let animationFrame = 0
    const refreshSize = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    }

    const observer = new ResizeObserver(refreshSize)
    observer.observe(container)
    window.addEventListener('resize', refreshSize)
    refreshSize()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', refreshSize)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [map])

  return null
}

function ParcelViewport({ parcel }: { parcel?: ParcelSelection }) {
  const map = useMap()

  useEffect(() => {
    if (parcel?.status !== 'found' || !parcel.boundary) return
    const feature = { type: 'Feature' as const, properties: {}, geometry: parcel.boundary }
    const bounds = L.geoJSON(feature).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [65, 65], maxZoom: 17, animate: false })
  }, [map, parcel])

  return null
}

export function MapExplorer({ stateCode, coordinates, parcel, parcelLoading, onSelect, onLocationLabel }: {
  stateCode: string
  coordinates: Coordinates
  parcel?: ParcelSelection
  parcelLoading: boolean
  onSelect: SelectLocation
  onLocationLabel: (label: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [layer, setLayer] = useState<'street' | 'terrain'>('street')
  const mapRef = useRef<L.Map | null>(null)
  const state = getStateDefinition(stateCode)
  const parcelFeature = parcel?.status === 'found' && parcel.boundary
    ? { type: 'Feature' as const, properties: {}, geometry: parcel.boundary }
    : null
  const parcelStatusLabel = parcelLoading
    ? 'Finding parcel…'
    : parcel?.status === 'found'
      ? 'Official parcel outlined'
      : parcel?.status === 'none' && parcel.message.startsWith('No tax parcel')
        ? 'Click inside a parcel—not a street'
        : parcel?.status === 'none'
          ? 'Incomplete parcel record rejected'
          : 'Parcel boundary unavailable here'

  async function searchLocation(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const bounds = L.geoJSON(getStateFeature(stateCode)).getBounds()
      const params = new URLSearchParams({
        q: `${query.trim()}, ${state.name}`, format: 'jsonv2', limit: '8', countrycodes: 'us',
        viewbox: `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`,
        bounded: '1', addressdetails: '1',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'en' } })
      if (!response.ok) throw new Error('Search service unavailable')
      const data = await response.json() as SearchResult[]
      const inState = data.filter((result) => isPointInState({ lat: Number(result.lat), lng: Number(result.lon) }, stateCode)).slice(0, 5)
      setResults(inState)
      if (!inState.length) setError(`No ${state.name} locations found. Try a city, address, or ZIP code.`)
    } catch {
      setError('Location search is unavailable. You can still click the map.')
    } finally {
      setSearching(false)
    }
  }

  function chooseResult(result: SearchResult) {
    const point = { lat: Number(result.lat), lng: Number(result.lon) }
    onSelect(point, stateCode)
    onLocationLabel(result.display_name.replace(', United States', ''))
    setQuery(result.display_name.split(',').slice(0, 3).join(','))
    setResults([])
    mapRef.current?.flyTo([point.lat, point.lng], Math.max(mapRef.current.getZoom(), 12), { duration: 0.8 })
  }

  return (
    <section className="map-shell" aria-label={`${state.name} map explorer`}>
      <div className="map-search-panel">
        <form className="map-search" onSubmit={searchLocation}>
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${state.name} address, city, or ZIP`} aria-label={`Search ${state.name} location`} />
          {query && <button type="button" className="icon-button" onClick={() => { setQuery(''); setResults([]) }} aria-label="Clear search"><X size={16} /></button>}
          <button className="search-submit" disabled={searching} type="submit">
            {searching ? <LoaderCircle className="spin" size={17} /> : 'Search'}
          </button>
        </form>
        {(results.length > 0 || error) && (
          <div className="search-results">
            {error && <p className="search-error">{error}</p>}
            {results.map((result) => (
              <button type="button" key={`${result.lat}-${result.lon}`} onClick={() => chooseResult(result)}>
                <MapPin size={16} /><span>{result.display_name}</span>
              </button>
            ))}
            <small>Search results © OpenStreetMap contributors</small>
          </div>
        )}
      </div>
      <div className="map-layer-control">
        <button type="button" onClick={() => setLayer(layer === 'street' ? 'terrain' : 'street')}>
          <Layers size={17} /><span>{layer === 'street' ? 'Terrain' : 'Streets'}</span>
        </button>
      </div>
      <div className={`parcel-map-status ${parcelLoading ? 'loading' : parcel?.status || 'unsupported'}`}><ScanLine size={14} />{parcelStatusLabel}</div>
      <div className="map-instruction"><LocateFixed size={15} /> Drag to explore · click land to select and analyze</div>
      <MapContainer ref={mapRef} center={[coordinates.lat, coordinates.lng]} zoom={6} minZoom={3} className="main-map" zoomControl worldCopyJump>
        {layer === 'street' ? (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · State boundaries: U.S. Census Bureau' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        ) : (
          <TileLayer attribution='Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap · State boundaries: U.S. Census Bureau' url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
        )}
        <GeoJSON key={stateCode} data={getStateFeature(stateCode)} style={{ color: '#176b4b', weight: 1.5, opacity: 0.7, fillColor: '#7caf95', fillOpacity: 0.05, dashArray: '5 5' }} interactive={false} />
        {parcelFeature && <GeoJSON key={parcel?.id || `${coordinates.lat}-${coordinates.lng}`} data={parcelFeature} style={{ color: '#d86b16', weight: 4, opacity: 1, fillColor: '#f59f45', fillOpacity: 0.22 }} interactive={false} />}
        <Marker position={[coordinates.lat, coordinates.lng]} icon={markerIcon} draggable eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); const next = { lat: point.lat, lng: point.lng }; const nextState = findStateForPoint(next); if (nextState) onSelect(next, nextState.code); else event.target.setLatLng(coordinates) } }}>
          <Tooltip permanent direction="top" offset={[0, -38]}>Selected site</Tooltip>
        </Marker>
        <MapEvents onSelect={onSelect} />
        <StateViewport stateCode={stateCode} />
        <ParcelViewport parcel={parcel} />
        <MapReliability />
      </MapContainer>
    </section>
  )
}
