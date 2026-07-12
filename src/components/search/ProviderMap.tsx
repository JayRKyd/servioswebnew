'use client'
import { useEffect, useRef, useCallback } from 'react'
import type { ProviderHit } from '@/hooks/useProviderSearch'

// mapbox-gl is loaded as a plain script tag from /public — zero bundler involvement.
// This prevents Turbopack (and webpack) from ever seeing mapbox-gl in the module graph.

declare global {
  interface Window { mapboxgl: any }
}

const DEFAULT_CENTER: [number, number] = [-0.1276, 51.5074]
const DEFAULT_ZOOM = 12

function loadMapbox(): Promise<any> {
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl)

  if (!document.getElementById('mapbox-gl-css')) {
    const link = document.createElement('link')
    link.id = 'mapbox-gl-css'
    link.rel = 'stylesheet'
    link.href = '/mapbox-gl.css'
    document.head.appendChild(link)
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('mapbox-gl-js')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.mapboxgl))
      return
    }
    const script = document.createElement('script')
    script.id = 'mapbox-gl-js'
    script.src = '/mapbox-gl.js'
    script.onload = () => resolve(window.mapboxgl)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function ProviderMap({
  providers,
  selectedId,
  onSelect,
  onBoundsChange,
}: {
  providers: ProviderHit[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onBoundsChange: (ne: { lat: number; lng: number }, sw: { lat: number; lng: number }) => void
}) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<any>(null)
  const popupRef          = useRef<any>(null)
  const onBoundsChangeRef = useRef(onBoundsChange)
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange }, [onBoundsChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    let cancelled = false

    loadMapbox().then((mapboxgl) => {
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      map.on('load', () => {
        map.addSource('providers', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 50,
        })

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'providers',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#115e56',
            'circle-radius': ['step', ['get', 'point_count'], 20, 5, 26, 20, 32],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        })

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'providers',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 13,
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#ffffff' },
        })

        map.addLayer({
          id: 'provider-points',
          type: 'circle',
          source: 'providers',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#ffffff',
            'circle-radius': 18,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#115e56',
          },
        })

        map.addLayer({
          id: 'provider-labels',
          type: 'symbol',
          source: 'providers',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 13,
            'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#115e56' },
        })

        map.on('click', 'clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
          const clusterId = features[0]?.properties?.cluster_id
          if (!clusterId) return
          const source = map.getSource('providers')
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
            if (err) return
            map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom ?? DEFAULT_ZOOM + 2 })
          })
        })

        map.on('click', 'provider-points', (e: any) => {
          const feature = e.features?.[0]
          if (!feature) return
          const props = feature.properties
          const coords = feature.geometry.coordinates

          popupRef.current?.remove()
          popupRef.current = new mapboxgl.Popup({ offset: 25, closeButton: false })
            .setLngLat(coords)
            .setHTML(
              `<div style="font-family:sans-serif;padding:4px 2px;min-width:140px">
                <p style="font-weight:700;font-size:13px;margin:0 0 2px">${props.name}</p>
                <p style="font-size:12px;color:#6b7280;margin:0">★ ${Number(props.rating).toFixed(1)} · £${props.price}/hr</p>
              </div>`
            )
            .addTo(map)

          onSelect(props.user_id)
        })

        map.on('mouseenter', 'provider-points', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'provider-points', () => { map.getCanvas().style.cursor = '' })
        map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })

        // Emit viewport bounds → drives Algolia insideBoundingBox filter
        function emitBounds() {
          const b = map.getBounds()
          onBoundsChangeRef.current(
            { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
            { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng }
          )
        }

        let debounceTimer: ReturnType<typeof setTimeout>
        map.on('moveend', () => {
          clearTimeout(debounceTimer)
          debounceTimer = setTimeout(emitBounds, 250)
        })

        // Fire initial bounds so the list filters immediately to the London viewport
        emitBounds()

        syncProviders(map, providers)
      })

      mapRef.current = map
    }).catch(console.error)

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    syncProviders(map, providers)
  }, [providers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.setPaintProperty(
      'provider-points',
      'circle-stroke-color',
      selectedId
        ? ['case', ['==', ['get', 'user_id'], selectedId], '#f59e0b', '#1a56db']
        : '#1a56db'
    )
  }, [selectedId])

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-gray-100 text-center p-8">
        <div>
          <p className="text-2xl mb-2">🗺</p>
          <p className="font-semibold text-gray-700">Map view</p>
          <p className="mt-1 text-sm text-gray-500">
            Add <code className="rounded bg-gray-200 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable.
          </p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" />
}

function syncProviders(map: any, providers: ProviderHit[]) {
  const source = map.getSource('providers')
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: providers
      .filter((p) => p._geoloc)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p._geoloc!.lng, p._geoloc!.lat] },
        properties: {
          user_id: p.user_id,
          label: (p.business_name?.trim() || p.first_name)?.[0]?.toUpperCase() ?? '?',
          name: p.business_name?.trim() || `${p.first_name} ${p.last_name}`,
          rating: p.rating_average,
          price: p.hourly_rate,
        },
      })),
  })
}
