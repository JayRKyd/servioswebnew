import {
  Wrench, Zap, Droplets, Wind, Paintbrush, Hammer, Sparkles, Leaf,
  Home, Bug, Shield, Truck, Layers, TreePine, Shovel, Flame, Sun,
  Battery, BatteryCharging, Thermometer, Plug, ClipboardCheck,
  ChefHat, KeyRound, Grid3x3, Microwave, Scissors, Scroll,
  PanelLeft, Palette, Building2, Building, Gauge, Lightbulb,
  HardHat, Car, Cog, Clock, Armchair, Mountain, Landmark,
  Compass, MapPin, BarChart3, AlertTriangle, Waves, Flower2,
  ShieldCheck, DoorOpen, Expand, ArrowDown, Sofa, Circle,
  Frame, Fence, LineChart, ClipboardList, TriangleRight, Gem,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const TRADE_ICONS: Record<string, LucideIcon> = {

  // ── Trades & Repairs — core ──────────────────────────────────────────────
  appliance_repair:          Microwave,
  carpentry:                 Hammer,
  drywall:                   Grid3x3,
  electrical:                Zap,
  flooring:                  Layers,
  handyman:                  Wrench,
  hvac:                      Wind,
  landscaping:               Leaf,
  masonry:                   Building,
  moving_hauling:            Truck,
  painting:                  Paintbrush,
  plumbing:                  Droplets,
  pool_spa:                  Waves,
  roofing:                   Home,
  security_systems:          ShieldCheck,
  windows_doors:             DoorOpen,

  // ── Construction & Building ──────────────────────────────────────────────
  builders_general:          HardHat,
  bricklaying:               Layers,
  plastering:                Palette,
  tiling:                    Grid3x3,
  loft_conversion:           Expand,
  garage_conversion:         Car,
  house_extension:           Building2,
  conservatory_installation: Sun,
  basement_conversion:       ArrowDown,
  cladding:                  Layers,
  groundwork:                Shovel,
  demolition:                Hammer,
  steel_fabrication:         Cog,
  waste_clearance:           Shovel,
  listed_building:           Landmark,

  // ── Heating, Gas & Plumbing specialty ───────────────────────────────────
  gas_safe:                  Flame,
  boiler:                    Thermometer,
  central_heating:           Thermometer,
  heat_pump:                 Wind,
  underfloor_heating:        Layers,
  drain_unblocking:          Droplets,

  // ── Electrical specialty ─────────────────────────────────────────────────
  eicr_testing:              ClipboardCheck,
  pat_testing:               Plug,
  ev_charger:                BatteryCharging,
  solar_panel:               Sun,
  battery_storage:           Battery,
  smart_home:                Lightbulb,

  // ── Interior fit-out ─────────────────────────────────────────────────────
  kitchen_fitting:           ChefHat,
  bathroom_fitting:          Sparkles,
  wet_room:                  Droplets,
  bath_resurfacing:          Waves,
  wall_floor_tiling:         Grid3x3,
  carpets_lino:              Layers,
  wallpapering:              Scroll,
  curtain_blind_fitting:     PanelLeft,
  interior_decorating:       Palette,

  // ── Roofing & Exterior specialty ─────────────────────────────────────────
  fascias_soffits:           Building,
  chimney_sweep:             Flame,
  chimney_repair:            Building2,
  damp_proofing:             Shield,
  glazier:                   Frame,
  insulation:                Layers,

  // ── Garden & Outdoor ─────────────────────────────────────────────────────
  decking:                   Layers,
  fencing:                   Fence,
  driveways:                 Car,
  tree_surgery:              TreePine,
  garden_design:             Flower2,
  hedge_trimming:            Scissors,
  lawn_care:                 Leaf,
  garden_walls:              Building,
  pizza_oven:                Flame,

  // ── Specialist Trades ────────────────────────────────────────────────────
  locksmith:                 KeyRound,
  welder:                    Flame,
  stonemason:                Mountain,
  french_polisher:           Paintbrush,
  pest_control:              Bug,

  // ── Property Professionals ───────────────────────────────────────────────
  quantity_surveyor:         ClipboardList,
  building_surveyor:         Building2,
  architect:                 Compass,
  structural_engineer:       Cog,
  civil_engineer:            MapPin,
  epc_assessor:              BarChart3,
  asbestos_surveyor:         AlertTriangle,
  party_wall_surveyor:       Layers,
  damp_specialist:           Droplets,
  energy_assessor:           Gauge,
  interior_designer:         Palette,
  lighting_designer:         Lightbulb,

  // ── Cleaning Services ────────────────────────────────────────────────────
  domestic_cleaning:         Sparkles,
  end_of_tenancy:            KeyRound,
  carpet_cleaning:           Layers,
  window_cleaning:           Frame,
  gutter_cleaning:           Droplets,
  oven_cleaning:             Flame,
  pressure_washing:          Waves,
  post_construction_cleaning:HardHat,
  upholstery_cleaning:       Sofa,
  hard_floor_cleaning:       Layers,
  mould_remediation:         AlertTriangle,

  // ── Automotive & Mobile Vehicle Services ─────────────────────────────────
  mobile_mechanic:           Wrench,
  alloy_refurbishment:       Circle,
  mobile_valeting:           Sparkles,
  car_detailing:             Car,
  smart_repair:              Car,
  bumper_repair:             Car,
  windscreen_repair:         Frame,
  car_diagnostics:           Gauge,
  tyre_fitting:              Circle,
  ceramic_coating:           Shield,
  window_tinting:            Frame,
  vehicle_wrapping:          Layers,
  engine_reconditioning:     Cog,

  // ── Specialist Restoration & Craft ──────────────────────────────────────
  epoxy_flooring:            Layers,
  resin_worktops:            Grid3x3,
  furniture_restoration:     Armchair,
  antique_restoration:       Clock,
  upholstery:                Armchair,
  leather_repair:            Layers,
  wood_restoration:          TreePine,
  stone_restoration:         Mountain,
}

/** Returns the Lucide icon for a trade slug, falling back to Wrench. */
export function getTradeIcon(slug: string): LucideIcon {
  return TRADE_ICONS[slug] ?? Wrench
}

/** Lucide icons for each top-level category group. */
export const GROUP_ICONS: Record<string, LucideIcon> = {
  trades_repairs:         Wrench,
  property_professionals: Building2,
  cleaning:               Sparkles,
  automotive:             Car,
  specialist:             Gem,
}
