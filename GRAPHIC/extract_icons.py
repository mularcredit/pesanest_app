#!/usr/bin/env python3
"""
SVG Icon Extractor - Extracts all 40 accounting icons
"""

import xml.etree.ElementTree as ET
import os
import re

def extract_icons_from_svg(svg_file, output_dir="extracted_icons"):
    """Extract individual icons from the 40 Accounting Icons SVG"""
    
    # Create output directory
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Parse the SVG file
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    
    tree = ET.parse(svg_file)
    root = tree.getroot()
    
    # Get viewBox dimensions
    viewbox = root.get('viewBox', '0 0 1300 625')
    vb_parts = viewbox.split()
    total_width = float(vb_parts[2])
    total_height = float(vb_parts[3])
    
    # Calculate icon dimensions (8 columns x 5 rows = 40 icons)
    cols = 8
    rows = 5
    icon_width = total_width / cols
    icon_height = total_height / rows
    
    print(f"📊 SVG Analysis:")
    print(f"   Total size: {total_width} x {total_height}")
    print(f"   Grid: {cols} columns x {rows} rows = {cols * rows} icons")
    print(f"   Icon size: {icon_width} x {icon_height}")
    print()
    
    # Get the style element
    style_elem = root.find('.//{http://www.w3.org/2000/svg}style')
    style_content = style_elem.text if style_elem is not None else ""
    
    # Get all path elements (these contain the actual icon graphics)
    all_paths = root.findall('.//{http://www.w3.org/2000/svg}path')
    
    print(f"🎨 Found {len(all_paths)} path elements")
    print()
    print("✂️  Extracting icons...")
    
    # Extract each icon
    icon_count = 0
    for row in range(rows):
        for col in range(cols):
            icon_count += 1
            
            # Calculate the bounding box for this icon
            x_min = col * icon_width
            y_min = row * icon_height
            x_max = x_min + icon_width
            y_max = y_min + icon_height
            
            # Find all paths that fall within this bounding box
            icon_paths = []
            for path in all_paths:
                d = path.get('d', '')
                if d:
                    # Extract coordinates from path data
                    coords = re.findall(r'[-+]?\d*\.?\d+', d)
                    if coords:
                        try:
                            # Get first coordinate as a rough position check
                            path_x = float(coords[0]) if len(coords) > 0 else 0
                            path_y = float(coords[1]) if len(coords) > 1 else 0
                            
                            # Check if this path is in the current icon's region
                            if x_min <= path_x < x_max and y_min <= path_y < y_max:
                                icon_paths.append(path)
                        except:
                            pass
            
            # Create SVG for this icon
            svg_content = f'''<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     viewBox="{x_min} {y_min} {icon_width} {icon_height}" 
     width="200" height="200">
<style type="text/css">
{style_content}
</style>
'''
            
            # Add the paths for this icon
            for path in icon_paths:
                path_str = ET.tostring(path, encoding='unicode')
                svg_content += f"    {path_str}\n"
            
            svg_content += "</svg>"
            
            # Save the icon
            icon_name = f"icon_{icon_count:02d}_row{row+1}_col{col+1}.svg"
            output_file = os.path.join(output_dir, icon_name)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(svg_content)
            
            print(f"   ✓ {icon_name} ({len(icon_paths)} paths)")
    
    print()
    print(f"✅ Successfully extracted {icon_count} icons to '{output_dir}/' directory!")
    print()
    print("📁 You can now use these individual icon files in your project!")

if __name__ == "__main__":
    svg_file = "40 Accounting SVG File.svg"
    
    if os.path.exists(svg_file):
        # Remove old extracted_icons directory if it exists
        import shutil
        if os.path.exists("extracted_icons"):
            shutil.rmtree("extracted_icons")
        
        extract_icons_from_svg(svg_file)
    else:
        print(f"❌ Error: {svg_file} not found!")
        print(f"Please run this script from the GRAPHIC directory")
