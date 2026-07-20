1-here is the ``` Company name/tagline/short description (for seed copy, emails, etc.)``` , so here is the answer ```# Company Profile and Copy Deck
**Source Website:** `dsnp.ir`

This document outlines the extracted identity, brand statement, and description profile converted entirely to English for seed copy, digital campaigns, and communication frameworks.

---

### Brand Identification
* **Company Name:** Faradis Industrial Group (Sensors & Thermal Management Division)
* **Core Product Focus:** Industrial Temperature Sensors, RTDs (PT100/PT1000), Thermocouples, Heating Elements, and Panel Instrumentation Systems.

### Seed Copy Options (No Persian Characters)

#### 1. Short Description / Tagline (For Email Signatures & Metadata)
> "Faradis Industrial Group: Precision-engineered industrial temperature sensors, robust thermal instrumentation, and advanced process heating elements designed for demanding automation environments."

#### 2. Seed Copy Paragraph (For Introduction Emails & Corporate Portfolios)
> "Faradis is a premier engineering manufacturer specializing in industrial thermal automation components. The product catalog features specialized RTD sensors (PT100/PT1000), heavy-duty high-temperature thermocouples, process control elements, and digital instrumentation systems. Engineered with structural reliability, Faradis components support accurate monitoring, reliable electrical panel distribution, and optimal thermodynamic stability across complex automated assembly lines."

#### 3. Core Capabilities List (For Sales outreach / B2B copy)
* Custom headmount and cable-type RTD configurations (`PT100` through `PT2000`).
* High-durability ungrounded and ceramic noble metal thermocouples.
* Industrial process controllers, loop-powered transmitters, and robust thermowells.```
2- we want ``` Product types you actually sell (e.g. thermocouples, cables, sensors...) with their real spec fields (temp range, material, gauge, etc.)``` so it is from the ```RTD(PT100)","Thermocouple","Instrumentation","Element (Heater)","Electrical Panel Equipment","Temperature Sensor Accessories","Controller```. for their real spec you need to check this::

 ```# Industrial Product Catalog Schema Specification
## E-Commerce Architecture & Attributes Guide

This document details the exact technical specification fields and data types required for cataloging industrial instrumentation, heating, and automation products. It is structured to align with standard taxonomy rules for inventory management and filtering engines.

---

## 1. RTD (PT100)
**Subcategories:** PT100, PT1000

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Sensor Element Type | Selection | PT100, PT1000, Duplex (2xPT100) |
| Accuracy Class | Selection | Class A, Class B, 1/3 DIN |
| Temperature Range | String/Range | -50C to +400C, -200C to +600C |
| Wiring Configuration | Selection | 2-wire, 3-wire, 4-wire |
| Sheath Diameter & Length | Numeric + Unit | 3mm, 6mm, 8mm \| 50mm, 100mm, 140mm, 170mm |
| Connection Type | Selection | Headmount (Terminal Head), Cable-type, Plate-type |
| Process Thread Type | Selection | Fixed Thread, Movable Thread, No Thread |
| Thread Size | Selection | 1/2 inch BSP, 3/4 inch NPT, M20x1.5 |

---

## 2. Thermocouple
**Subcategories:** Type K, Type J, Type R, Type S, Type E, Flexible

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Thermocouple Type | Selection | Type K, Type J, Type E, Type N, Type S, Type R, Type B |
| Temperature Range | String/Range | 0C to 1200C (Type K), 0C to 1600C (Type S/R) |
| Sheath Material | Selection | Stainless Steel 304/316, Inconel 600, Ceramic (C799/C610), Ceramic SIC |
| Junction Configuration | Selection | Grounded, Ungrounded, Exposed |
| Form Factor | Selection | Straight Probe, Flexible Mineral Insulated (MI), L-Shaped, Bayonet |
| Connection Mechanism | Selection | Terminal Block Head (Jumo/WIKA style), Extension Lead Wire, Miniature Plug |

---

## 3. Instrumentation
**Subcategories:** Liquid Level Gauge (LLS), Pressure Gauge (Manometer)

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Instrument Category | Selection | Level Measurement, Pressure Measurement, Flow Measurement |
| Measurement Range | String/Range | 0 to 10 Bar, -1 to 0 Bar (Vacuum), 0-100 cm (Level) |
| Output Signal | Selection | 4-20 mA Analog, 0-10 VDC, RS485 Modbus, Pure Mechanical/Dial |
| Dial/Display Size | Selection | 63mm, 100mm, 160mm (For Manometers) |
| Mounting & Connection | Selection | Bottom Entry, Back Entry, Flanged Connection |
| Accuracy Class | Numeric | CL 1.0, CL 1.6, CL 2.5 |

---

## 4. Element (Heater)
**Subcategories:** SIC, Flanged, Band/Belt, Glass, Plate, Cartridge, Tubular, Heating Cable

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Heater Architecture | Selection | Cartridge, Tubular, Band/Nozzle, Ceramic, Silicon Carbide (SIC) |
| Electrical Wattage | Numeric | 250W, 500W, 1000W, 2500W, 5kW |
| Supply Voltage | Selection | 110 VAC, 220 VAC (Single Phase), 380-400 VAC (Three Phase) |
| Physical Dimensions | String | Diameter x Length (e.g., 10mm x 100mm), Band Dimensions (290x100mm) |
| Terminal Connection Type | Selection | Ceramic Terminal Block, Screw Terminals, High-Temp Lead Wires, Euro Plug |
| Max Operating Temp | Numeric | 300C (Band), 700C (Cartridge), 1400C (SIC) |

---

## 5. Electrical Panel Equipment
**Subcategories:** Relays, Solid State Relays (SSR)

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Component Type | Selection | Solid State Relay (SSR), Industrial Relay, Contactor, Miniature Circuit Breaker |
| Current Rating (Amperage) | Numeric | 10A, 25A (e.g., Celduc 25A), 40A, 75A, 100A |
| Control Voltage (Input) | Selection | 3-32 VDC, 90-280 VAC, 24 VAC/DC |
| Load Voltage (Output) | Selection | 24-380 VAC, 48-600 VAC |
| Number of Phases/Poles | Selection | 1-Phase (Single), 3-Phase |
| Mounting Configuration | Selection | DIN Rail Mount, Panel Mount (Heat sink mounting) |

---

## 6. Temperature Sensor Accessories
**Subcategories:** RTD Accessories, Thermocouple Accessories, Thermocouple Cables

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Accessory Category | Selection | Thermowell, Extension Cable, Compression Fitting, Ceramic Insulator, Terminal Head |
| Cable Insulation Material | Selection | PVC, Teflon (PTFE), Fiberglass, Stainless Steel Braided (SS Overbraid) |
| Thermowell Type | Selection | Drilled Barstock, Fabricated Pipe, Tapered, Flanged, Threaded |
| Material / Metallurgy | Selection | SS304, SS316, SS310, Ceramic 610 |
| Fitting/Thread Dimension | Selection | 1/4 inch BSP, 1/2 inch NPT, Bayonet Lock Adapter M12 |

---

## 7. Controller
**Subcategories:** Transmitters, Thermostats, Thermometers, Humidity Controllers

| Field Name | Data Type | Example Values / Real Options |
| :--- | :--- | :--- |
| Controller Type | Selection | Temperature Controller (Thermostat), Headmount Transmitter, Indicator/Thermometer, Humidity Controller |
| Input Signal Compatibility | Selection | Universal (TC K/J/S, RTD PT100), Fixed PT100, 4-20mA Linear |
| Control Output Type | Selection | Relay Contact, SSR Pulse (Drive), 4-20mA Analog, Linear Voltage |
| Control Algorithm | Selection | ON/OFF, PID Autotuning |
| Physical Dimensions (DIN Size) | Selection | 48x48 mm (1/16 DIN), 72x72 mm, 96x96 mm (1/4 DIN), DIN Rail mount |
| Supply Voltage | Selection | 100-240 VAC, 24 VDC/VAC |```

3- and this is the ``` A handful of real products per type with real specs/SKUs``` which come here ```# Expanded Industrial Product Catalog - Sample Products & SKUs
## Real Product Models with Specifications

This document provides a comprehensive selection of sample products across all categories. In accordance with requirements, the first category contains 10 real product samples, while all subsequent categories contain at least 2 distinct models.

---

## 1. RTD (PT100)

### SKU: RTD-PT100-A-6X150-H-12B
* **Product Name:** Industrial Headmount PT100 Temperature Sensor
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** Class A
* **Temperature Range:** -50C to +400C
* **Wiring Configuration:** 3-wire
* **Sheath Diameter:** 6mm
* **Sheath Length:** 150mm
* **Connection Type:** Headmount (Aluminum Terminal Head)
* **Process Thread Type:** Fixed Thread
* **Thread Size:** 1/2 inch BSP

### SKU: RTD-PT100D-B-8X200-M-34N
* **Product Name:** Duplex RTD Sensor with Movable Process Thread
* **Sensor Element Type:** Duplex (2xPT100)
* **Accuracy Class:** Class B
* **Temperature Range:** -200C to +600C
* **Wiring Configuration:** 4-wire
* **Sheath Diameter:** 8mm
* **Sheath Length:** 200mm
* **Connection Type:** Headmount (Explosion-Proof Terminal Head)
* **Process Thread Type:** Movable Thread
* **Thread Size:** 3/4 inch NPT

### SKU: RTD-PT1000-A-4X100-C-TFL
* **Product Name:** Compact Teflon Insulated PT1000 Sensor
* **Sensor Element Type:** PT1000 (Single Element)
* **Accuracy Class:** Class A
* **Temperature Range:** -50C to +200C
* **Wiring Configuration:** 2-wire
* **Sheath Diameter:** 4mm
* **Sheath Length:** 100mm
* **Connection Type:** Cable-type
* **Process Thread Type:** No Thread
* **Thread Size:** None

### SKU: RTD-PT100-A-6X050-M-12N
* **Product Name:** Short Sheath Machinery RTD Sensor
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** Class A
* **Temperature Range:** -40C to +250C
* **Wiring Configuration:** 3-wire
* **Sheath Diameter:** 6mm
* **Sheath Length:** 50mm
* **Connection Type:** Cable-type with Stainless Steel Overbraid
* **Process Thread Type:** Movable Thread
* **Thread Size:** 1/2 inch NPT

### SKU: RTD-PT100-13D-6X140-H-12B
* **Product Name:** 1/3 DIN Ultra-Precision RTD
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** 1/3 DIN
* **Temperature Range:** 0C to +150C
* **Wiring Configuration:** 4-wire
* **Sheath Diameter:** 6mm
* **Sheath Length:** 140mm
* **Connection Type:** Headmount (Standard Terminal Head)
* **Process Thread Type:** Fixed Thread
* **Thread Size:** 1/2 inch BSP

### SKU: RTD-PT100D-A-6X300-H-34B
* **Product Name:** Long Reach Duplex Headmount RTD
* **Sensor Element Type:** Duplex (2xPT100)
* **Accuracy Class:** Class A
* **Temperature Range:** -50C to +450C
* **Wiring Configuration:** 3-wire per element
* **Sheath Diameter:** 6mm
* **Sheath Length:** 300mm
* **Connection Type:** Headmount (Aluminum Terminal Head)
* **Process Thread Type:** Fixed Thread
* **Thread Size:** 3/4 inch BSP

### SKU: RTD-PT100-B-3X100-C-SLK
* **Product Name:** Micro-Diameter Silicone Cable RTD
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** Class B
* **Temperature Range:** -50C to +180C
* **Wiring Configuration:** 3-wire
* **Sheath Diameter:** 3mm
* **Sheath Length:** 100mm
* **Connection Type:** Cable-type (Silicone Rubber Jacket)
* **Process Thread Type:** No Thread
* **Thread Size:** None

### SKU: RTD-PT100-A-8X170-M-M20
* **Product Name:** Heavy Duty Metric Thread RTD
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** Class A
* **Temperature Range:** -70C to +500C
* **Wiring Configuration:** 4-wire
* **Sheath Diameter:** 8mm
* **Sheath Length:** 170mm
* **Connection Type:** Headmount (Explosion-Proof Terminal Head)
* **Process Thread Type:** Movable Thread
* **Thread Size:** M20x1.5

### SKU: RTD-PT100-PLT-50X50
* **Product Name:** Surface Mount Plate-Type RTD Sensor
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** Class B
* **Temperature Range:** -30C to +150C
* **Wiring Configuration:** 3-wire
* **Sheath Diameter:** Not Applicable (Flat Plate Geometry)
* **Sheath Length:** 50mm x 50mm Plate Dimensions
* **Connection Type:** Plate-type
* **Process Thread Type:** No Thread (Surface Bolt Mounting)
* **Thread Size:** None

### SKU: RTD-PT100-QTZ-6X250-N
* **Product Name:** High-Purity Quartz Sheath RTD
* **Sensor Element Type:** PT100 (Single Element)
* **Accuracy Class:** Class A
* **Temperature Range:** -200C to +650C
* **Wiring Configuration:** 4-wire
* **Sheath Diameter:** 6mm
* **Sheath Length:** 250mm
* **Connection Type:** Terminal Head
* **Sheath Material:** Quartz Glass
* **Process Thread Type:** No Thread
* **Thread Size:** None

---

## 2. Thermocouple

### SKU: TC-K-SS316-6X300-U-HEAD
* **Product Name:** High-Temperature Type K Thermocouple
* **Thermocouple Type:** Type K
* **Temperature Range:** 0C to 1100C
* **Sheath Material:** Stainless Steel 316
* **Junction Configuration:** Ungrounded
* **Form Factor:** Straight Probe
* **Connection Mechanism:** Standard Aluminum Terminal Head

### SKU: TC-S-SIC-20X500-E-CER
* **Product Name:** Ceramic Noble Metal Thermocouple
* **Thermocouple Type:** Type S
* **Temperature Range:** 0C to 1600C
* **Sheath Material:** Ceramic Silicon Carbide (SIC) outer sleeve
* **Junction Configuration:** Exposed
* **Form Factor:** Straight Heavy Duty Probe
* **Connection Mechanism:** Large Terminal Block Head

---

## 3. Instrumentation

### SKU: INS-PG-10B-100-B
* **Product Name:** Industrial Bourdon Tube Pressure Gauge
* **Instrument Category:** Pressure Measurement
* **Measurement Range:** 0 to 10 Bar
* **Output Signal:** Pure Mechanical Dial
* **Dial/Display Size:** 100mm
* **Mounting & Connection:** Bottom Entry (1/2 inch BSP)
* **Accuracy Class:** CL 1.0

### SKU: INS-LLS-420-100C-F
* **Product Name:** Hydrostatic Liquid Level Transmitter
* **Instrument Category:** Level Measurement
* **Measurement Range:** 0 to 100 cm H2O
* **Output Signal:** 4-20 mA Analog
* **Dial/Display Size:** No Local Display
* **Mounting & Connection:** Flanged Connection
* **Accuracy Class:** CL 0.5

---

## 4. Element (Heater)

### SKU: HTR-CAR-10X100-500W-220V
* **Product Name:** High-Watt Density Cartridge Heater
* **Heater Architecture:** Cartridge Heater
* **Electrical Wattage:** 500W
* **Supply Voltage:** 220 VAC (Single Phase)
* **Physical Dimensions:** 10mm Diameter x 100mm Length
* **Terminal Connection Type:** High-Temperature Flexible Lead Wires
* **Max Operating Temp:** 700C

### SKU: HTR-BND-290100-2.5KW-380V
* **Product Name:** Stainless Steel Band Heater for Extruders
* **Heater Architecture:** Band/Nozzle Heater
* **Electrical Wattage:** 2500W (2.5kW)
* **Supply Voltage:** 380 VAC (Three Phase)
* **Physical Dimensions:** 290mm Inner Diameter x 100mm Width
* **Terminal Connection Type:** Ceramic Terminal Block Block Protection Box
* **Max Operating Temp:** 300C

---

## 5. Electrical Panel Equipment

### SKU: EPE-SSR-CEL-25A-D3
* **Product Name:** Celduc Style Single-Phase Solid State Relay
* **Component Type:** Solid State Relay (SSR)
* **Current Rating (Amperage):** 25A
* **Control Voltage (Input):** 3-32 VDC
* **Load Voltage (Output):** 24-380 VAC
* **Number of Phases/Poles:** 1-Phase (Single Pole)
* **Mounting Configuration:** Panel Mount

### SKU: EPE-SSR-3P-75A-A4
* **Product Name:** Heavy Duty Three-Phase Solid State Relay
* **Component Type:** Solid State Relay (SSR)
* **Current Rating (Amperage):** 75A
* **Control Voltage (Input):** 90-280 VAC
* **Load Voltage (Output):** 48-600 VAC
* **Number of Phases/Poles:** 3-Phase (Three Pole)
* **Mounting Configuration:** Integrated DIN Rail Mount

---

## 6. Temperature Sensor Accessories

### SKU: ACC-TW-BAR-316-1/2NPT
* **Product Name:** Tapered Barstock Thermowell
* **Accessory Category:** Thermowell
* **Cable Insulation Material:** Not Applicable
* **Thermowell Type:** Drilled Barstock (Tapered)
* **Material / Metallurgy:** Stainless Steel 316
* **Fitting/Thread Dimension:** 1/2 inch NPT Instrument Connection, 3/4 inch NPT Process Connection

### SKU: ACC-CBL-K-FG-SS-7/0.2
* **Product Name:** Fiberglass Insulated Type K Extension Cable
* **Accessory Category:** Extension Cable
* **Cable Insulation Material:** Fiberglass with Stainless Steel Braided Overbraid
* **Thermowell Type:** Not Applicable
* **Material / Metallurgy:** KX Grade Thermocouple Alloys
* **Fitting/Thread Dimension:** 7/0.2mm stranded wire configuration

---

## 7. Controller

### SKU: CTL-TC-48X48-PID-R
* **Product Name:** Digital PID Temperature Controller
* **Controller Type:** Temperature Controller (Thermostat)
* **Input Signal Compatibility:** Universal (TC K/J/S, RTD PT100)
* **Control Output Type:** Relay Contact (5A) + SSR Pulse Drive (12VDC)
* **Control Algorithm:** PID Autotuning or ON/OFF
* **Physical Dimensions (DIN Size):** 48x48 mm (1/16 DIN)
* **Supply Voltage:** 100-240 VAC

### SKU: CTL-TX-PT100-420-HEAD
* **Product Name:** Headmount In-Head PT100 Temperature Transmitter
* **Controller Type:** Headmount Transmitter
* **Input Signal Compatibility:** Fixed PT100 (2 or 3 wire)
* **Control Output Type:** 4-20 mA Analog
* **Control Algorithm:** Linear Voltage Transmitter
* **Physical Dimensions (DIN Size):** Circular Hockey-Puck Form Factor
* **Supply Voltage:** 12-35 VDC```

4- Real ordering-code configurators : this is here ```# Ordering Code Configurator: RTD Temperature Sensor
**Prefix System:** `FRH-`

This document defines the segment breakdown (position → meaning → allowed values/ranges) for the configurable headmount RTD sensor line.

---

### Field 1: Sensor Element Type
* **Type:** Enum
* **Description:** Identifies the resistance element baseline. If it is a duplex (double) element sensor, the number `2` is prefixed to the letter (e.g., `2M` for Duplex PT100).
* **Allowed Values:**
  * `L` = PT50
  * `M` = PT100
  * `D` = PT500
  * `T` = PT1000
  * `Q` = PT2000

### Field 2: Accuracy Class
* **Type:** Enum
* **Description:** The calibration tolerance class of the element.
* **Allowed Values:**
  * `A` = Class A (Accuracy 0.01 degrees)
  * `B` = Class B (Accuracy 0.1 degrees)

### Field 3: Temperature Measurement Range
* **Type:** Enum
* **Description:** The operating temperature limit of the sensor in Celsius.
* **Allowed Values:**
  * `1` = -50°C to +250°C
  * `2` = -50°C to +400°C
  * `3` = -200°C to +600°C
  * `4` = -200°C to +800°C

### Field 4: Wiring Configuration (Number of Wires)
* **Type:** Enum
* **Description:** The internal lead wire count hookup.
* **Allowed Values:**
  * `3` = 3-wire system
  * `4` = 4-wire system
  * `6` = 6-wire system

### Field 5: Connection Head Style
* **Type:** Enum
* **Description:** The external enclosure form factor design.
* **Allowed Values:**
  * `A` = Style A Head
  * `B` = Style B Head
  * `C` = Style C Head
  * `D` = Style D Head

### Field 6: Head to Sheath Mounting Type
* **Type:** Enum
* **Description:** The mechanical architecture linking the terminal box to the protection probe.
* **Allowed Values:**
  * `CS` = Thread directly connected to the head
  * `RS` = Stem/rod connected directly to the head
  * `CH` = Thread connected with a cold extension neck
  * `BH` = Connected via union nut (Nipple-Union-Nipple setup)
  * `SH` = Detachable / separable assembly

### Field 7: Internal Head Electronics
* **Type:** Enum
* **Description:** The component housed inside the terminal connection cavity.
* **Allowed Values:**
  * `B` = Terminal Ceramic Block
  * `T` = Temperature Transmitter (4-20mA loop block)

### Field 8: Process Connection Fitting Availability
* **Type:** Enum
* **Description:** Toggles the inclusion of a mounting process connector or fitting thread.
* **Allowed Values:**
  * `1` = Yes (Included)
  * `0` = No (Not Included)

### Field 9: Process Connection Material
* **Type:** Enum
* **Description:** The metallurgical composition of the process fitting.
* **Allowed Values:**
  * `S04` = Stainless Steel 304 (SS304)
  * `S16` = Stainless Steel 316 (SS316)
  * `0` = No connection fitting / Not Applicable

### Field 10: Process Connection Size
* **Type:** Enum
* **Description:** The structural thread scale size for mounting.
* **Allowed Values:**
  * `S` = 1/2" NPT
  * `F` = 3/4" NPT
  * `T` = 1/4" NPT
  * `E` = 1/8" NPT
  * `P` = 1" NPT
  * `M` = M12x1 metric thread
  * `0` = No thread / Not Applicable

### Field 11: Sheath Outer Diameter
* **Type:** Number (Strictly 2 digits)
* **Description:** The outer structural diameter measurement of the metal probe housing expressed in millimeters.
* **Allowed Values / Formatting Examples:**
  * `06` = 6 mm diameter
  * `14` = 14 mm diameter

### Field 12: Sheath Insertion Length
* **Type:** Number (Strictly 4 digits)
* **Description:** The physical immersion depth length of the probe housing tube expressed in millimeters.
* **Allowed Values / Formatting Examples:**
  * `0200` = 200 mm length
  * `1500` = 1500 mm length

### Field 13: Sheath Material
* **Type:** Enum
* **Description:** The metallurgical or outer protective material of the primary immersion tube.
* **Allowed Values:**
  * `S04` = Stainless Steel 304 (SS304)
  * `S16` = Stainless Steel 316 (SS316)
  * `0` = Without Sheath / None
  * `C9` = Alsint Ceramic Tube
  * `C95` = Pythagoras Ceramic Tube
  * `P` = Teflon (PTFE) protection sleeve
  * `T` = Titanium metal tube

### Field 14: Thermowell Integration Accessory
* **Type:** Enum
* **Description:** Declares if an additional protective thermowell sleeve structural enclosure is bundled.
* **Allowed Values:**
  * `1` = Yes (Requires filling out secondary Thermowell Type "TW" form sheet)
  * `0` = No```
