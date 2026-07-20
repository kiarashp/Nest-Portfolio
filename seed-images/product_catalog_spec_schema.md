# Industrial Product Catalog Schema Specification
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
| Supply Voltage | Selection | 100-240 VAC, 24 VDC/VAC |
