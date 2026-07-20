/**
 * Static seed data for dev-data.seed.ts — split out into its own file purely
 * for readability given its size. No logic lives here, only plain data.
 *
 * Company: Faradis Industrial Group (Sensors & Thermal Management Division).
 * The product types, products, SKUs, and the FRH ordering-code configurator
 * below are drawn from the company's real catalog and ordering-code system
 * (see forseeding.md), not placeholder data. Image filenames reference real
 * product photos in the repo-root seed-images/ directory.
 */

import { SegmentDataType } from 'src/configurator/enums/segment-data-type.enum'

// --- Company copy -----------------------------------------------------------

export const COMPANY = {
  name: 'Faradis Industrial Group',
  tagline:
    'Precision-engineered industrial temperature sensors, robust thermal instrumentation, and advanced process heating elements designed for demanding automation environments.',
  description:
    'Faradis is a premier engineering manufacturer specializing in industrial thermal automation components. The product catalog features specialized RTD sensors (PT100/PT1000), heavy-duty high-temperature thermocouples, process control elements, and digital instrumentation systems. Engineered with structural reliability, Faradis components support accurate monitoring, reliable electrical panel distribution, and optimal thermodynamic stability across complex automated assembly lines.',
}

// --- Product catalog ---------------------------------------------------------

export interface SeedFilterableField {
  key: string
  label: string
  type: 'number' | 'enum' | 'string'
  unit?: string
  options?: string[]
}

export interface SeedProductType {
  name: string
  slug: string
  filterableFields: SeedFilterableField[]
  /** seed-images filename used as the landing-page type card image */
  image: string
}

export interface SeedProduct {
  name: string
  slug: string
  sku: string
  productTypeSlug: string
  shortDescription: string
  description?: string
  specs?: Record<string, unknown>
  isPublished?: boolean
  isFeatured?: boolean
  /** seed-images filenames; first is the main image, the rest become the gallery */
  images?: string[]
}

export const PRODUCT_TYPES: SeedProductType[] = [
  {
    name: 'RTD (PT100) Temperature Sensors',
    slug: 'rtd-pt100',
    image: 'rtd-pt100-middle-thread-14cm-headmount-1.webp',
    filterableFields: [
      {
        key: 'sensorElementType',
        label: 'Sensor Element Type',
        type: 'enum',
        options: ['PT100', 'PT1000', 'Duplex (2xPT100)'],
      },
      {
        key: 'accuracyClass',
        label: 'Accuracy Class',
        type: 'enum',
        options: ['Class A', 'Class B', '1/3 DIN'],
      },
      {
        key: 'temperatureRange',
        label: 'Temperature Range',
        type: 'enum',
        options: [
          '-50C to +400C',
          '-200C to +600C',
          '-50C to +200C',
          '-40C to +250C',
          '0C to +150C',
          '-50C to +450C',
          '-50C to +180C',
          '-70C to +500C',
          '-30C to +150C',
          '-200C to +650C',
        ],
      },
      {
        key: 'wiringConfiguration',
        label: 'Wiring Configuration',
        type: 'enum',
        options: ['2-wire', '3-wire', '4-wire'],
      },
      {
        key: 'sheathDiameter',
        label: 'Sheath Diameter',
        type: 'number',
        unit: 'mm',
      },
      {
        key: 'sheathLength',
        label: 'Sheath Length',
        type: 'number',
        unit: 'mm',
      },
      {
        key: 'connectionType',
        label: 'Connection Type',
        type: 'enum',
        options: ['Headmount', 'Cable-type', 'Plate-type', 'Terminal Head'],
      },
      {
        key: 'processThreadType',
        label: 'Process Thread Type',
        type: 'enum',
        options: ['Fixed Thread', 'Movable Thread', 'No Thread'],
      },
      {
        key: 'threadSize',
        label: 'Thread Size',
        type: 'enum',
        options: [
          '1/2 inch BSP',
          '3/4 inch NPT',
          '1/2 inch NPT',
          'M20x1.5',
          '3/4 inch BSP',
        ],
      },
      {
        key: 'sheathMaterial',
        label: 'Sheath Material',
        type: 'enum',
        options: ['Stainless Steel 316', 'Stainless Steel 304', 'Quartz Glass'],
      },
    ],
  },
  {
    name: 'Thermocouples',
    slug: 'thermocouple',
    image: 'type-k-thermocouple-20cm-1-4-1.webp',
    filterableFields: [
      {
        key: 'thermocoupleType',
        label: 'Thermocouple Type',
        type: 'enum',
        options: [
          'Type K',
          'Type J',
          'Type E',
          'Type N',
          'Type S',
          'Type R',
          'Type B',
        ],
      },
      {
        key: 'temperatureRange',
        label: 'Temperature Range',
        type: 'enum',
        options: ['0C to 1100C', '0C to 1200C', '0C to 1600C'],
      },
      {
        key: 'sheathMaterial',
        label: 'Sheath Material',
        type: 'enum',
        options: [
          'Stainless Steel 304',
          'Stainless Steel 316',
          'Inconel 600',
          'Ceramic (C799/C610)',
          'Ceramic SIC',
        ],
      },
      {
        key: 'junctionConfiguration',
        label: 'Junction Configuration',
        type: 'enum',
        options: ['Grounded', 'Ungrounded', 'Exposed'],
      },
      {
        key: 'formFactor',
        label: 'Form Factor',
        type: 'enum',
        options: [
          'Straight Probe',
          'Flexible Mineral Insulated (MI)',
          'L-Shaped',
          'Bayonet',
        ],
      },
      {
        key: 'connectionMechanism',
        label: 'Connection Mechanism',
        type: 'enum',
        options: [
          'Terminal Block Head (Jumo/WIKA style)',
          'Extension Lead Wire',
          'Miniature Plug',
        ],
      },
    ],
  },
  {
    name: 'Instrumentation',
    slug: 'instrumentation',
    image: 'Magnetic-sphere-for-switch-level-meter-1.jpg',
    filterableFields: [
      {
        key: 'instrumentCategory',
        label: 'Instrument Category',
        type: 'enum',
        options: [
          'Level Measurement',
          'Pressure Measurement',
          'Flow Measurement',
        ],
      },
      {
        key: 'measurementRange',
        label: 'Measurement Range',
        type: 'enum',
        options: ['0 to 10 Bar', '0 to 100 cm H2O'],
      },
      {
        key: 'outputSignal',
        label: 'Output Signal',
        type: 'enum',
        options: [
          'Pure Mechanical/Dial',
          '4-20 mA Analog',
          '0-10 VDC',
          'RS485 Modbus',
        ],
      },
      {
        key: 'dialDisplaySize',
        label: 'Dial/Display Size',
        type: 'enum',
        options: ['63mm', '100mm', '160mm', 'No Local Display'],
      },
      {
        key: 'mountingConnection',
        label: 'Mounting & Connection',
        type: 'enum',
        options: ['Bottom Entry', 'Back Entry', 'Flanged Connection'],
      },
      {
        key: 'accuracyClass',
        label: 'Accuracy Class',
        type: 'enum',
        options: ['CL 0.5', 'CL 1.0', 'CL 1.6', 'CL 2.5'],
      },
    ],
  },
  {
    name: 'Heating Elements',
    slug: 'heating-element',
    image: 'ceramic-heating-element-120x100-1.webp',
    filterableFields: [
      {
        key: 'heaterArchitecture',
        label: 'Heater Architecture',
        type: 'enum',
        options: [
          'Cartridge',
          'Tubular',
          'Band/Nozzle',
          'Ceramic',
          'Silicon Carbide (SIC)',
        ],
      },
      {
        key: 'electricalWattage',
        label: 'Electrical Wattage',
        type: 'number',
        unit: 'W',
      },
      {
        key: 'supplyVoltage',
        label: 'Supply Voltage',
        type: 'enum',
        options: [
          '110 VAC',
          '220 VAC (Single Phase)',
          '380-400 VAC (Three Phase)',
        ],
      },
      {
        key: 'physicalDimensions',
        label: 'Physical Dimensions',
        type: 'string',
      },
      {
        key: 'terminalConnectionType',
        label: 'Terminal Connection Type',
        type: 'enum',
        options: [
          'Ceramic Terminal Block',
          'Screw Terminals',
          'High-Temp Lead Wires',
          'Euro Plug',
        ],
      },
      {
        key: 'maxOperatingTemp',
        label: 'Max Operating Temp',
        type: 'number',
        unit: 'C',
      },
    ],
  },
  {
    name: 'Electrical Panel Equipment',
    slug: 'electrical-panel-equipment',
    image: 'SSR-relay-75A-Fotek.jpg',
    filterableFields: [
      {
        key: 'componentType',
        label: 'Component Type',
        type: 'enum',
        options: [
          'Solid State Relay (SSR)',
          'Industrial Relay',
          'Contactor',
          'Miniature Circuit Breaker',
        ],
      },
      {
        key: 'currentRating',
        label: 'Current Rating',
        type: 'number',
        unit: 'A',
      },
      {
        key: 'controlVoltage',
        label: 'Control Voltage (Input)',
        type: 'enum',
        options: ['3-32 VDC', '90-280 VAC', '24 VAC/DC'],
      },
      {
        key: 'loadVoltage',
        label: 'Load Voltage (Output)',
        type: 'enum',
        options: ['24-380 VAC', '48-600 VAC'],
      },
      {
        key: 'phasesPoles',
        label: 'Number of Phases/Poles',
        type: 'enum',
        options: ['1-Phase (Single)', '3-Phase'],
      },
      {
        key: 'mountingConfiguration',
        label: 'Mounting Configuration',
        type: 'enum',
        options: ['DIN Rail Mount', 'Panel Mount (Heat sink mounting)'],
      },
    ],
  },
  {
    name: 'Temperature Sensor Accessories',
    slug: 'sensor-accessories',
    image: 'Type-J-interface-wire-cross-section-03-1-scaled.jpg',
    filterableFields: [
      {
        key: 'accessoryCategory',
        label: 'Accessory Category',
        type: 'enum',
        options: [
          'Thermowell',
          'Extension Cable',
          'Compression Fitting',
          'Ceramic Insulator',
          'Terminal Head',
        ],
      },
      {
        key: 'cableInsulationMaterial',
        label: 'Cable Insulation Material',
        type: 'enum',
        options: [
          'PVC',
          'Teflon (PTFE)',
          'Fiberglass',
          'Stainless Steel Braided (SS Overbraid)',
          'Fiberglass + SS Overbraid',
        ],
      },
      {
        key: 'thermowellType',
        label: 'Thermowell Type',
        type: 'enum',
        options: [
          'Drilled Barstock',
          'Fabricated Pipe',
          'Tapered',
          'Flanged',
          'Threaded',
        ],
      },
      {
        key: 'materialMetallurgy',
        label: 'Material / Metallurgy',
        type: 'enum',
        options: [
          'SS304',
          'SS316',
          'SS310',
          'Ceramic 610',
          'KX Grade Thermocouple Alloys',
        ],
      },
      {
        key: 'fittingThreadDimension',
        label: 'Fitting/Thread Dimension',
        type: 'string',
      },
    ],
  },
  {
    name: 'Controllers',
    slug: 'controller',
    image: 'rex-c100-temperature-controller-1.webp',
    filterableFields: [
      {
        key: 'controllerType',
        label: 'Controller Type',
        type: 'enum',
        options: [
          'Temperature Controller (Thermostat)',
          'Headmount Transmitter',
          'Indicator/Thermometer',
          'Humidity Controller',
        ],
      },
      {
        key: 'inputSignalCompatibility',
        label: 'Input Signal Compatibility',
        type: 'enum',
        options: [
          'Universal (TC K/J/S, RTD PT100)',
          'Fixed PT100',
          '4-20mA Linear',
        ],
      },
      {
        key: 'controlOutputType',
        label: 'Control Output Type',
        type: 'enum',
        options: [
          'Relay Contact',
          'Relay Contact + SSR Pulse Drive',
          'SSR Pulse (Drive)',
          '4-20mA Analog',
          'Linear Voltage',
        ],
      },
      {
        key: 'controlAlgorithm',
        label: 'Control Algorithm',
        type: 'enum',
        options: ['ON/OFF', 'PID Autotuning'],
      },
      {
        key: 'physicalDimensionsDin',
        label: 'Physical Dimensions (DIN Size)',
        type: 'enum',
        options: [
          '48x48 mm (1/16 DIN)',
          '72x72 mm',
          '96x96 mm (1/4 DIN)',
          'DIN Rail mount',
          'Circular Hockey-Puck Form Factor',
        ],
      },
      {
        key: 'supplyVoltage',
        label: 'Supply Voltage',
        type: 'enum',
        options: ['100-240 VAC', '24 VDC/VAC', '12-35 VDC'],
      },
    ],
  },
]

export const PRODUCTS: SeedProduct[] = [
  // --- RTD (PT100) ---------------------------------------------------------
  {
    name: 'Industrial Headmount PT100 Temperature Sensor',
    slug: 'rtd-pt100-headmount-a-6x150',
    sku: 'RTD-PT100-A-6X150-H-12B',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Class A headmount PT100 sensor, 6mm x 150mm, 3-wire, 1/2" BSP fixed thread',
    description:
      'A general-purpose headmount PT100 sensor for process and machinery temperature monitoring, with an aluminum terminal head and a fixed 1/2" BSP process thread for straightforward installation.',
    isFeatured: true,
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class A',
      temperatureRange: '-50C to +400C',
      wiringConfiguration: '3-wire',
      sheathDiameter: 6,
      sheathLength: 150,
      connectionType: 'Headmount',
      processThreadType: 'Fixed Thread',
      threadSize: '1/2 inch BSP',
    },
    images: [
      'rtd-pt100-middle-thread-14cm-headmount-1.webp',
      'rtd-pt100-middle-thread-14cm-headmount-2.webp',
      'rtd-pt100-middle-thread-14cm-headmount-3.webp',
    ],
  },
  {
    name: 'Duplex RTD Sensor with Movable Process Thread',
    slug: 'rtd-pt100-duplex-explosion-proof-8x200',
    sku: 'RTD-PT100D-B-8X200-M-34N',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Explosion-proof duplex PT100 sensor, 8mm x 200mm, 4-wire, 3/4" NPT movable thread',
    specs: {
      sensorElementType: 'Duplex (2xPT100)',
      accuracyClass: 'Class B',
      temperatureRange: '-200C to +600C',
      wiringConfiguration: '4-wire',
      sheathDiameter: 8,
      sheathLength: 200,
      connectionType: 'Headmount',
      processThreadType: 'Movable Thread',
      threadSize: '3/4 inch NPT',
    },
    images: [
      'Head-for-temperature-sensor-and-thermocouple-double-Wika-1.jpg',
      'Head-for-temperature-sensor-and-thermocouple-double-Wika-2.jpg',
      'Head-for-temperature-sensor-and-thermocouple-double-Wika-3.jpg',
    ],
  },
  {
    name: 'Compact Teflon Insulated PT1000 Sensor',
    slug: 'rtd-pt1000-cable-teflon-4x100',
    sku: 'RTD-PT1000-A-4X100-C-TFL',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Compact cable-type PT1000 sensor with Teflon insulation, 4mm x 100mm, 2-wire',
    specs: {
      sensorElementType: 'PT1000',
      accuracyClass: 'Class A',
      temperatureRange: '-50C to +200C',
      wiringConfiguration: '2-wire',
      sheathDiameter: 4,
      sheathLength: 100,
      connectionType: 'Cable-type',
      processThreadType: 'No Thread',
    },
    images: [
      'rtd-t100-tempreture-sensor-15cm-1.webp',
      'rtd-t100-tempreture-sensor-15cm-2.webp',
      'rtd-t100-tempreture-sensor-15cm-3.webp',
    ],
  },
  {
    name: 'Short Sheath Machinery RTD Sensor',
    slug: 'rtd-pt100-cable-overbraid-6x050',
    sku: 'RTD-PT100-A-6X050-M-12N',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Short-sheath PT100 sensor with stainless overbraid cable, 6mm x 50mm, 3-wire',
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class A',
      temperatureRange: '-40C to +250C',
      wiringConfiguration: '3-wire',
      sheathDiameter: 6,
      sheathLength: 50,
      connectionType: 'Cable-type',
      processThreadType: 'Movable Thread',
      threadSize: '1/2 inch NPT',
    },
    images: ['rtd-pt100-4w-ex-3m-17cm-6mm.webp'],
  },
  {
    name: '1/3 DIN Ultra-Precision RTD',
    slug: 'rtd-pt100-13din-headmount-6x140',
    sku: 'RTD-PT100-13D-6X140-H-12B',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Ultra-precision 1/3 DIN PT100 headmount sensor, 6mm x 140mm, 4-wire',
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: '1/3 DIN',
      temperatureRange: '0C to +150C',
      wiringConfiguration: '4-wire',
      sheathDiameter: 6,
      sheathLength: 140,
      connectionType: 'Headmount',
      processThreadType: 'Fixed Thread',
      threadSize: '1/2 inch BSP',
    },
  },
  {
    name: 'Long Reach Duplex Headmount RTD',
    slug: 'rtd-pt100-duplex-headmount-6x300',
    sku: 'RTD-PT100D-A-6X300-H-34B',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Long-reach duplex PT100 headmount sensor, 6mm x 300mm, 3-wire per element, 3/4" BSP',
    specs: {
      sensorElementType: 'Duplex (2xPT100)',
      accuracyClass: 'Class A',
      temperatureRange: '-50C to +450C',
      wiringConfiguration: '3-wire',
      sheathDiameter: 6,
      sheathLength: 300,
      connectionType: 'Headmount',
      processThreadType: 'Fixed Thread',
      threadSize: '3/4 inch BSP',
    },
  },
  {
    name: 'Micro-Diameter Silicone Cable RTD',
    slug: 'rtd-pt100-cable-silicone-3x100',
    sku: 'RTD-PT100-B-3X100-C-SLK',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Micro-diameter PT100 sensor with silicone rubber cable jacket, 3mm x 100mm, 3-wire',
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class B',
      temperatureRange: '-50C to +180C',
      wiringConfiguration: '3-wire',
      sheathDiameter: 3,
      sheathLength: 100,
      connectionType: 'Cable-type',
    },
  },
  {
    name: 'Heavy Duty Metric Thread RTD',
    slug: 'rtd-pt100-headmount-m20-8x170',
    sku: 'RTD-PT100-A-8X170-M-M20',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Explosion-proof PT100 headmount sensor with M20x1.5 thread, 8mm x 170mm, 4-wire',
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class A',
      temperatureRange: '-70C to +500C',
      wiringConfiguration: '4-wire',
      sheathDiameter: 8,
      sheathLength: 170,
      connectionType: 'Headmount',
      processThreadType: 'Movable Thread',
      threadSize: 'M20x1.5',
    },
    images: [
      'Head-for-temperaturesensor-and-thermocouple-medium-1.jpg',
      'Head-for-temperaturesensor-and-thermocouple-medium-2.jpg',
      'Head-for-temperaturesensor-and-thermocouple-medium-3.jpg',
    ],
  },
  {
    name: 'Surface Mount Plate-Type RTD Sensor',
    slug: 'rtd-pt100-plate-50x50',
    sku: 'RTD-PT100-PLT-50X50',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'Surface-mount plate-type PT100 sensor, 50mm x 50mm plate, 3-wire',
    description:
      'A flat plate-geometry PT100 sensor bolted directly to a machined surface for equipment and structural temperature monitoring — no sheath diameter/length applies, only the 50mm x 50mm plate footprint.',
    isPublished: false,
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class B',
      temperatureRange: '-30C to +150C',
      wiringConfiguration: '3-wire',
      connectionType: 'Plate-type',
      processThreadType: 'No Thread',
    },
  },
  {
    name: 'High-Purity Quartz Sheath RTD',
    slug: 'rtd-pt100-quartz-6x250',
    sku: 'RTD-PT100-QTZ-6X250-N',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'High-purity quartz sheath PT100 sensor, 6mm x 250mm, 4-wire',
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class A',
      temperatureRange: '-200C to +650C',
      wiringConfiguration: '4-wire',
      sheathDiameter: 6,
      sheathLength: 250,
      connectionType: 'Terminal Head',
      sheathMaterial: 'Quartz Glass',
      processThreadType: 'No Thread',
    },
  },
  {
    name: 'L-Shaped Cable-Type PT100 Sensor',
    slug: 'rtd-pt100-l-shaped-6x100',
    sku: 'RTD-PT100-A-6X100-L-CBL',
    productTypeSlug: 'rtd-pt100',
    shortDescription:
      'L-shaped cable-type PT100 sensor for tight installation spaces, 6mm x 100mm, 3-wire',
    specs: {
      sensorElementType: 'PT100',
      accuracyClass: 'Class A',
      temperatureRange: '-50C to +200C',
      wiringConfiguration: '3-wire',
      sheathDiameter: 6,
      sheathLength: 100,
      connectionType: 'Cable-type',
    },
    images: ['rtd-pt100-l-shaped-10cm.webp'],
  },

  // --- Thermocouples --------------------------------------------------------
  {
    name: 'High-Temperature Type K Thermocouple',
    slug: 'tc-type-k-ss316-300mm',
    sku: 'TC-K-SS316-6X300-U-HEAD',
    productTypeSlug: 'thermocouple',
    shortDescription:
      'Ungrounded Type K thermocouple probe, SS316 sheath, 300mm, standard terminal head',
    description:
      'A general-purpose ungrounded Type K thermocouple probe with a stainless steel 316 sheath, suited to most industrial process temperature ranges up to 1100C.',
    isFeatured: true,
    specs: {
      thermocoupleType: 'Type K',
      temperatureRange: '0C to 1100C',
      sheathMaterial: 'Stainless Steel 316',
      junctionConfiguration: 'Ungrounded',
      formFactor: 'Straight Probe',
      connectionMechanism: 'Terminal Block Head (Jumo/WIKA style)',
    },
    images: [
      'type-k-thermocouple-20cm-1-4-1.webp',
      'type-k-thermocouple-20cm-1-4-2.webp',
      'type-k-thermocouple-20cm-1-4-3.webp',
    ],
  },
  {
    name: 'Ceramic Noble Metal Thermocouple',
    slug: 'tc-type-s-ceramic-sic-500mm',
    sku: 'TC-S-SIC-20X500-E-CER',
    productTypeSlug: 'thermocouple',
    shortDescription:
      'Heavy-duty exposed-junction Type S thermocouple with ceramic SIC outer sleeve, 500mm',
    specs: {
      thermocoupleType: 'Type S',
      temperatureRange: '0C to 1600C',
      sheathMaterial: 'Ceramic SIC',
      junctionConfiguration: 'Exposed',
      formFactor: 'Straight Probe',
      connectionMechanism: 'Terminal Block Head (Jumo/WIKA style)',
    },
  },

  // --- Instrumentation -------------------------------------------------------
  {
    name: 'Industrial Bourdon Tube Pressure Gauge',
    slug: 'ins-pressure-gauge-10bar-100mm',
    sku: 'INS-PG-10B-100-B',
    productTypeSlug: 'instrumentation',
    shortDescription:
      '100mm dial Bourdon tube pressure gauge, 0-10 Bar, bottom entry',
    isPublished: false,
    specs: {
      instrumentCategory: 'Pressure Measurement',
      measurementRange: '0 to 10 Bar',
      outputSignal: 'Pure Mechanical/Dial',
      dialDisplaySize: '100mm',
      mountingConnection: 'Bottom Entry',
      accuracyClass: 'CL 1.0',
    },
  },
  {
    name: 'Hydrostatic Liquid Level Transmitter',
    slug: 'ins-level-transmitter-hydrostatic',
    sku: 'INS-LLS-420-100C-F',
    productTypeSlug: 'instrumentation',
    shortDescription:
      'Flanged hydrostatic level transmitter, 0-100cm H2O, 4-20mA output',
    specs: {
      instrumentCategory: 'Level Measurement',
      measurementRange: '0 to 100 cm H2O',
      outputSignal: '4-20 mA Analog',
      dialDisplaySize: 'No Local Display',
      mountingConnection: 'Flanged Connection',
      accuracyClass: 'CL 0.5',
    },
  },
  {
    name: 'Seesaw-Type Level Switch',
    slug: 'ins-level-switch-seesaw',
    sku: 'INS-LSW-SEESAW-STD',
    productTypeSlug: 'instrumentation',
    shortDescription:
      'Mechanical seesaw-type level switch for bulk solids and liquids',
    specs: {
      instrumentCategory: 'Level Measurement',
      outputSignal: 'Pure Mechanical/Dial',
      mountingConnection: 'Bottom Entry',
    },
    images: [
      'level-switch-seesaw-1.jpg',
      'level-switch-seesaw-2.jpg',
      'level-switch-seesaw-3.jpg',
    ],
  },
  {
    name: 'Magnetic Float Level Switch',
    slug: 'ins-level-switch-magnetic-float',
    sku: 'INS-LSW-MAGFLOAT-STD',
    productTypeSlug: 'instrumentation',
    shortDescription: 'Magnetic sphere float switch for tank level detection',
    specs: {
      instrumentCategory: 'Level Measurement',
      outputSignal: 'Pure Mechanical/Dial',
      mountingConnection: 'Bottom Entry',
    },
    images: [
      'Magnetic-sphere-for-switch-level-meter-1.jpg',
      'Magnetic-sphere-for-switch-level-meter-2.jpg',
    ],
  },

  // --- Heating elements -------------------------------------------------------
  {
    name: 'High-Watt Density Cartridge Heater',
    slug: 'htr-cartridge-10x100-500w',
    sku: 'HTR-CAR-10X100-500W-220V',
    productTypeSlug: 'heating-element',
    shortDescription:
      '500W cartridge heater, 10mm x 100mm, 220VAC, flexible high-temp lead wires',
    specs: {
      heaterArchitecture: 'Cartridge',
      electricalWattage: 500,
      supplyVoltage: '220 VAC (Single Phase)',
      physicalDimensions: '10mm diameter x 100mm length',
      terminalConnectionType: 'High-Temp Lead Wires',
      maxOperatingTemp: 700,
    },
  },
  {
    name: 'High-Wattage Cartridge Heater 10x700mm',
    slug: 'htr-cartridge-10x700-1500w',
    sku: 'HTR-CAR-10X700-1500W-220V',
    productTypeSlug: 'heating-element',
    shortDescription:
      '1500W high-wattage cartridge heater, 10mm x 700mm, 220VAC',
    specs: {
      heaterArchitecture: 'Cartridge',
      electricalWattage: 1500,
      supplyVoltage: '220 VAC (Single Phase)',
      physicalDimensions: '10mm diameter x 700mm length',
      terminalConnectionType: 'High-Temp Lead Wires',
      maxOperatingTemp: 700,
    },
    images: [
      'cartrige-heater-10x700-1500w-1.webp',
      'cartrige-heater-10x700-1500w-2.webp',
    ],
  },
  {
    name: 'Stainless Steel Band Heater for Extruders',
    slug: 'htr-band-290x100-2500w',
    sku: 'HTR-BND-290100-2.5KW-380V',
    productTypeSlug: 'heating-element',
    shortDescription:
      '2.5kW stainless steel band heater for extruder barrels, 290mm ID x 100mm width, 380VAC three-phase',
    isPublished: false,
    specs: {
      heaterArchitecture: 'Band/Nozzle',
      electricalWattage: 2500,
      supplyVoltage: '380-400 VAC (Three Phase)',
      physicalDimensions: '290mm inner diameter x 100mm width',
      terminalConnectionType: 'Ceramic Terminal Block',
      maxOperatingTemp: 300,
    },
  },
  {
    name: 'Ceramic Heating Element 120x100mm',
    slug: 'htr-ceramic-120x100',
    sku: 'HTR-CER-120X100-800W-220V',
    productTypeSlug: 'heating-element',
    shortDescription:
      'Ceramic infrared heating element plate, 120mm x 100mm, 220VAC',
    specs: {
      heaterArchitecture: 'Ceramic',
      electricalWattage: 800,
      supplyVoltage: '220 VAC (Single Phase)',
      physicalDimensions: '120mm x 100mm plate',
      terminalConnectionType: 'Ceramic Terminal Block',
      maxOperatingTemp: 600,
    },
    images: [
      'ceramic-heating-element-120x100-1.webp',
      'ceramic-heating-element-120x100-2.webp',
      'ceramic-heating-element-120x100-3.webp',
    ],
  },
  {
    name: 'OEM Dishwasher Heating Element',
    slug: 'htr-tubular-dishwasher-oem',
    sku: 'HTR-TUB-DW-1800W-220V',
    productTypeSlug: 'heating-element',
    shortDescription:
      'Tubular OEM replacement heating element for LG dishwashers, 1800W, 220VAC',
    specs: {
      heaterArchitecture: 'Tubular',
      electricalWattage: 1800,
      supplyVoltage: '220 VAC (Single Phase)',
      physicalDimensions: 'Tubular, 230mm length',
      terminalConnectionType: 'Screw Terminals',
      maxOperatingTemp: 120,
    },
    images: [
      'lg-dishwasher-heating-element-1.webp',
      'lg-dishwasher-heating-element-2.webp',
      'lg-dishwasher-heating-element-3.webp',
    ],
  },

  // --- Electrical panel equipment --------------------------------------------
  {
    name: 'Celduc Style Single-Phase Solid State Relay',
    slug: 'epe-ssr-celduc-25a',
    sku: 'EPE-SSR-CEL-25A-D3',
    productTypeSlug: 'electrical-panel-equipment',
    shortDescription:
      '25A single-phase solid state relay, Celduc style, panel mount',
    isFeatured: true,
    specs: {
      componentType: 'Solid State Relay (SSR)',
      currentRating: 25,
      controlVoltage: '3-32 VDC',
      loadVoltage: '24-380 VAC',
      phasesPoles: '1-Phase (Single)',
      mountingConfiguration: 'Panel Mount (Heat sink mounting)',
    },
    images: ['SSR-relay-celduc-25-amps.jpg'],
  },
  {
    name: 'Heavy Duty Three-Phase Solid State Relay',
    slug: 'epe-ssr-3phase-75a',
    sku: 'EPE-SSR-3P-75A-A4',
    productTypeSlug: 'electrical-panel-equipment',
    shortDescription:
      '75A three-phase solid state relay with integrated DIN rail mount',
    isFeatured: true,
    specs: {
      componentType: 'Solid State Relay (SSR)',
      currentRating: 75,
      controlVoltage: '90-280 VAC',
      loadVoltage: '48-600 VAC',
      phasesPoles: '3-Phase',
      mountingConfiguration: 'DIN Rail Mount',
    },
    images: ['SSR-relay-75A-Fotek.jpg'],
  },
  {
    name: 'Finder 8-Pin Industrial Relay',
    slug: 'epe-relay-finder-10a-8pin',
    sku: 'EPE-REL-FIN-10A-8P',
    productTypeSlug: 'electrical-panel-equipment',
    shortDescription:
      '10A general-purpose 8-pin industrial relay, Finder-style, DIN rail socket mount',
    specs: {
      componentType: 'Industrial Relay',
      currentRating: 10,
      controlVoltage: '24 VAC/DC',
      loadVoltage: '24-380 VAC',
      phasesPoles: '1-Phase (Single)',
      mountingConfiguration: 'DIN Rail Mount',
    },
    images: [
      '10A-relay-8pin-Finder-1.jpg',
      '10A-relay-8pin-Finder-2.jpg',
      '10A-relay-8pin-Finder-3.jpg',
    ],
  },

  // --- Temperature sensor accessories -----------------------------------------
  {
    name: 'Tapered Barstock Thermowell',
    slug: 'acc-thermowell-barstock-ss316',
    sku: 'ACC-TW-BAR-316-1/2NPT',
    productTypeSlug: 'sensor-accessories',
    shortDescription:
      'SS316 tapered barstock thermowell, 1/2" NPT instrument x 3/4" NPT process connection',
    specs: {
      accessoryCategory: 'Thermowell',
      thermowellType: 'Drilled Barstock',
      materialMetallurgy: 'SS316',
      fittingThreadDimension:
        '1/2 inch NPT instrument connection, 3/4 inch NPT process connection',
    },
  },
  {
    name: 'Fiberglass Insulated Type K Extension Cable',
    slug: 'acc-extension-cable-type-k-fiberglass',
    sku: 'ACC-CBL-K-FG-SS-7/0.2',
    productTypeSlug: 'sensor-accessories',
    shortDescription:
      'Fiberglass-insulated Type K thermocouple extension cable with stainless steel overbraid, 7/0.2mm stranded',
    specs: {
      accessoryCategory: 'Extension Cable',
      cableInsulationMaterial: 'Fiberglass + SS Overbraid',
      materialMetallurgy: 'KX Grade Thermocouple Alloys',
      fittingThreadDimension: '7/0.2mm stranded wire configuration',
    },
    images: [
      'Type-J-interface-wire-cross-section-03-1-scaled.jpg',
      'Type-J-interface-wire-cross-section-03-2-scaled.jpg',
      'Type-J-interface-wire-cross-section-03-3-scaled.jpg',
    ],
  },

  // --- Controllers -------------------------------------------------------------
  {
    name: 'Digital PID Temperature Controller',
    slug: 'ctl-pid-temperature-controller-48x48',
    sku: 'CTL-TC-48X48-PID-R',
    productTypeSlug: 'controller',
    shortDescription:
      '48x48mm DIN digital PID temperature controller with relay + SSR pulse outputs',
    description:
      'A universal-input 1/16 DIN PID temperature controller accepting thermocouple (K/J/S) or RTD PT100 inputs, with a relay contact plus an SSR pulse-drive output for slow-cycling heater loads.',
    isFeatured: true,
    specs: {
      controllerType: 'Temperature Controller (Thermostat)',
      inputSignalCompatibility: 'Universal (TC K/J/S, RTD PT100)',
      controlOutputType: 'Relay Contact + SSR Pulse Drive',
      controlAlgorithm: 'PID Autotuning',
      physicalDimensionsDin: '48x48 mm (1/16 DIN)',
      supplyVoltage: '100-240 VAC',
    },
    images: ['rex-c100-temperature-controller-1.webp'],
  },
  {
    name: 'Headmount In-Head PT100 Temperature Transmitter',
    slug: 'ctl-headmount-transmitter-pt100',
    sku: 'CTL-TX-PT100-420-HEAD',
    productTypeSlug: 'controller',
    shortDescription:
      'Headmount 2-wire PT100 temperature transmitter, 4-20mA output, hockey-puck form factor',
    specs: {
      controllerType: 'Headmount Transmitter',
      inputSignalCompatibility: 'Fixed PT100',
      controlOutputType: '4-20mA Analog',
      physicalDimensionsDin: 'Circular Hockey-Puck Form Factor',
      supplyVoltage: '12-35 VDC',
    },
    images: ['Endress-Hauser-iTEMP-TMT80.jpg'],
  },
  {
    name: 'Jumo EM-2 Mechanical Thermostat',
    slug: 'ctl-jumo-em2-thermostat',
    sku: 'CTL-THM-JUMO-EM2',
    productTypeSlug: 'controller',
    shortDescription:
      'Jumo EM-2 style mechanical capillary thermostat with ON/OFF relay output',
    specs: {
      controllerType: 'Temperature Controller (Thermostat)',
      inputSignalCompatibility: 'Universal (TC K/J/S, RTD PT100)',
      controlOutputType: 'Relay Contact',
      controlAlgorithm: 'ON/OFF',
      physicalDimensionsDin: 'DIN Rail mount',
      supplyVoltage: '100-240 VAC',
    },
    images: [
      'Jumo-EM-2-Thermostat-1.jpg',
      'Jumo-EM-2-Thermostat-2.jpg',
      'Jumo-EM-2-Thermostat-3.jpg',
    ],
  },
  {
    name: 'WIKA Dial Thermometer',
    slug: 'ctl-wika-dial-thermometer',
    sku: 'CTL-IND-WIKA-160MM',
    productTypeSlug: 'controller',
    shortDescription:
      'WIKA-style bimetal dial thermometer, 160mm dial, 0-160C range, 10cm stem',
    specs: {
      controllerType: 'Indicator/Thermometer',
      inputSignalCompatibility: 'Fixed PT100',
      physicalDimensionsDin: '96x96 mm (1/4 DIN)',
      supplyVoltage: '24 VDC/VAC',
    },
    images: [
      'thermometer-wika-16od-10cm-0-160-1.jpg',
      'thermometer-wika-16od-10cm-0-160-2.jpg',
      'thermometer-wika-16od-10cm-0-160-3.jpg',
    ],
  },
]

// --- Configurator: FRH headmount RTD ordering code --------------------------
//
// Modeled on the company's real FRH- ordering-code system (forseeding.md).
// Two adaptations were required by the resolver's rules (CONFIGURATOR.md
// §4.1): a SegmentOption.value can never be the literal string '0' (reserved
// for zero-fill), so the two fields whose real-world "not applicable" state is
// the digit 0 (process connection material/size) are instead modeled as
// conditional assignments that zero-fill automatically when the "process
// connection fitting" toggle (field 8) is answered "not included" — producing
// the same rendered '0' segments the real ordering code describes, without
// ever storing '0' as a selectable option. The gate field itself (field 8)
// and the thermowell toggle (field 14) use '1' (Included) / 'N' (Not
// included) instead of the real system's '1'/'0', for the same reason.

export interface SeedSegmentOption {
  value: string
  label: string
  sortOrder: number
}

export interface SeedSegmentDefinition {
  /** Local key used only to wire up assignments/conditions below — not persisted. */
  key: string
  name: string
  label: string
  dataType: SegmentDataType
  constraints?: Record<string, unknown>
  meaningTemplate: string
  options?: SeedSegmentOption[]
}

export interface SeedAssignmentCondition {
  controllingKey: string
  operator: 'eq'
  value: string
}

export interface SeedAssignment {
  definitionKey: string
  condition?: SeedAssignmentCondition
}

function opts(pairs: [string, string][]): SeedSegmentOption[] {
  return pairs.map(([value, label], index) => ({
    value,
    label,
    sortOrder: index,
  }))
}

export const FRH_SEGMENT_DEFINITIONS: SeedSegmentDefinition[] = [
  {
    key: 'sensorElementType',
    name: 'Sensor Element Type (FRH)',
    label: 'Sensor element type',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Sensor: {label}',
    options: opts([
      ['L', 'Single PT50'],
      ['M', 'Single PT100'],
      ['D', 'Single PT500'],
      ['T', 'Single PT1000'],
      ['Q', 'Single PT2000'],
      ['2L', 'Duplex PT50'],
      ['2M', 'Duplex PT100'],
      ['2D', 'Duplex PT500'],
      ['2T', 'Duplex PT1000'],
      ['2Q', 'Duplex PT2000'],
    ]),
  },
  {
    key: 'accuracyClass',
    name: 'Accuracy Class (FRH)',
    label: 'Accuracy class',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Accuracy: {label}',
    options: opts([
      ['A', 'Class A (+/-0.01 degrees)'],
      ['B', 'Class B (+/-0.1 degrees)'],
    ]),
  },
  {
    key: 'temperatureRange',
    name: 'Temperature Measurement Range (FRH)',
    label: 'Temperature range',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Range: {label}',
    options: opts([
      ['1', '-50C to +250C'],
      ['2', '-50C to +400C'],
      ['3', '-200C to +600C'],
      ['4', '-200C to +800C'],
    ]),
  },
  {
    key: 'wiringConfiguration',
    name: 'Wiring Configuration (FRH)',
    label: 'Wiring configuration',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Wiring: {label}',
    options: opts([
      ['3', '3-wire system'],
      ['4', '4-wire system'],
      ['6', '6-wire system'],
    ]),
  },
  {
    key: 'headStyle',
    name: 'Connection Head Style (FRH)',
    label: 'Connection head style',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Head style: {label}',
    options: opts([
      ['A', 'Style A head'],
      ['B', 'Style B head'],
      ['C', 'Style C head'],
      ['D', 'Style D head'],
    ]),
  },
  {
    key: 'headMounting',
    name: 'Head-to-Sheath Mounting (FRH)',
    label: 'Head-to-sheath mounting',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Mounting: {label}',
    options: opts([
      ['CS', 'Thread directly connected to the head'],
      ['RS', 'Stem/rod connected directly to the head'],
      ['CH', 'Thread connected with a cold extension neck'],
      ['BH', 'Connected via union nut (nipple-union-nipple)'],
      ['SH', 'Detachable / separable assembly'],
    ]),
  },
  {
    key: 'headElectronics',
    name: 'Internal Head Electronics (FRH)',
    label: 'Internal head electronics',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Electronics: {label}',
    options: opts([
      ['B', 'Terminal ceramic block'],
      ['T', 'Temperature transmitter (4-20mA loop)'],
    ]),
  },
  {
    key: 'fittingGate',
    name: 'Process Connection Fitting (FRH)',
    label: 'Process connection fitting included?',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Process fitting: {label}',
    options: opts([
      ['1', 'Included'],
      ['N', 'Not included'],
    ]),
  },
  {
    key: 'fittingMaterial',
    name: 'Process Connection Material (FRH)',
    label: 'Process connection material',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Fitting material: {label}',
    options: opts([
      ['S04', 'Stainless Steel 304 (SS304)'],
      ['S16', 'Stainless Steel 316 (SS316)'],
    ]),
  },
  {
    key: 'fittingSize',
    name: 'Process Connection Size (FRH)',
    label: 'Process connection size',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Fitting size: {label}',
    options: opts([
      ['S', '1/2 inch NPT'],
      ['F', '3/4 inch NPT'],
      ['T', '1/4 inch NPT'],
      ['E', '1/8 inch NPT'],
      ['P', '1 inch NPT'],
      ['M', 'M12x1 metric thread'],
    ]),
  },
  {
    key: 'sheathDiameter',
    name: 'Sheath Outer Diameter (FRH)',
    label: 'Sheath outer diameter (mm)',
    dataType: SegmentDataType.NUMBER,
    constraints: { digits: 2, min: 3, max: 25 },
    meaningTemplate: 'Sheath diameter: {value} mm',
  },
  {
    key: 'sheathLength',
    name: 'Sheath Insertion Length (FRH)',
    label: 'Sheath insertion length (mm)',
    dataType: SegmentDataType.NUMBER,
    constraints: { digits: 4, min: 50, max: 3000 },
    meaningTemplate: 'Insertion length: {value} mm',
  },
  {
    key: 'sheathMaterial',
    name: 'Sheath Material (FRH)',
    label: 'Sheath material',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Sheath material: {label}',
    options: opts([
      ['S04', 'Stainless Steel 304 (SS304)'],
      ['S16', 'Stainless Steel 316 (SS316)'],
      ['C9', 'Alsint ceramic tube'],
      ['C95', 'Pythagoras ceramic tube'],
      ['P', 'PTFE (Teflon) protection sleeve'],
      ['T', 'Titanium tube'],
    ]),
  },
  {
    key: 'thermowell',
    name: 'Thermowell Integration (FRH)',
    label: 'Bundle a thermowell?',
    dataType: SegmentDataType.SELECT,
    meaningTemplate: 'Thermowell: {label}',
    options: opts([
      ['1', 'Yes - bundled with a thermowell'],
      ['N', 'No'],
    ]),
  },
]

// Order matters — assignments are created in this order (default position:
// append), so a condition's controllingKey must appear earlier in this list.
export const FRH_ASSIGNMENTS: SeedAssignment[] = [
  { definitionKey: 'sensorElementType' },
  { definitionKey: 'accuracyClass' },
  { definitionKey: 'temperatureRange' },
  { definitionKey: 'wiringConfiguration' },
  { definitionKey: 'headStyle' },
  { definitionKey: 'headMounting' },
  { definitionKey: 'headElectronics' },
  { definitionKey: 'fittingGate' },
  {
    definitionKey: 'fittingMaterial',
    condition: { controllingKey: 'fittingGate', operator: 'eq', value: '1' },
  },
  {
    definitionKey: 'fittingSize',
    condition: { controllingKey: 'fittingGate', operator: 'eq', value: '1' },
  },
  { definitionKey: 'sheathDiameter' },
  { definitionKey: 'sheathLength' },
  { definitionKey: 'sheathMaterial' },
  { definitionKey: 'thermowell' },
]

export const FRH_CONFIGURABLE_PRODUCT = {
  name: 'Industrial Headmount RTD Sensor (FRH Series)',
  slug: 'frh-headmount-rtd-sensor',
  codePrefix: 'FRH',
  description:
    'Build a custom ordering code for the FRH-series industrial headmount RTD (PT100 through PT2000) temperature sensor: choose the sensing element, accuracy class, temperature range, wiring, head style and mounting, electronics, process connection, sheath dimensions and material, and an optional thermowell. The composed code and a human-readable summary are generated instantly.',
  image: 'rtd-pt100-middle-thread-14cm-headmount-1.webp',
}

// --- Posts (updated to match the Faradis catalog above) --------------------

export const POST_TAGS = [
  { name: 'News', slug: 'news' },
  { name: 'Engineering', slug: 'engineering' },
  { name: 'Announcements', slug: 'announcements' },
  { name: 'Product Updates', slug: 'product-updates' },
]
