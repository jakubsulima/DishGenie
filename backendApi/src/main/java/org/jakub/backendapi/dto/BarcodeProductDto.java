package org.jakub.backendapi.dto;

public class BarcodeProductDto {
    private String barcode;
    private String name;
    private String brand;

    public BarcodeProductDto() {
    }

    public BarcodeProductDto(String barcode, String name, String brand) {
        this.barcode = barcode;
        this.name = name;
        this.brand = brand;
    }

    public String getBarcode() { return barcode; }
    public String getName() { return name; }
    public String getBrand() { return brand; }
}
