// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DocumentController.java

package com.toolmanager.controller;

import com.toolmanager.dto.DocumentDto;
import com.toolmanager.dto.DocumentVersionDto;
import com.toolmanager.service.DocumentService;
import com.toolmanager.service.DocumentVersionService;
import org.springframework.http.ResponseEntity;

public class DocumentController
{

    public ResponseEntity getAllDocuments()
    {
        return ResponseEntity.ok(documentService.getAll());
    }

    public ResponseEntity getByCategory(String category)
    {
        return ResponseEntity.ok(documentService.getByCategory(category));
    }

    public ResponseEntity getBySubCategory(String category, String subCategory)
    {
        return ResponseEntity.ok(documentService.getBySubCategory(category, subCategory));
    }

    public ResponseEntity searchByTitle(String title)
    {
        return ResponseEntity.ok(documentService.searchByTitle(title));
    }

    public ResponseEntity getById(Long id)
    {
        DocumentDto document = documentService.getById(id);
        if(document == null)
            return ResponseEntity.notFound().build();
        else
            return ResponseEntity.ok(document);
    }

    public ResponseEntity saveDocument(DocumentDto dto)
    {
        DocumentDto saved = documentService.save(dto);
        return ResponseEntity.ok(saved);
    }

    public ResponseEntity updateDocument(Long id, DocumentDto dto)
    {
        dto.setId(id);
        DocumentDto updated = documentService.save(dto);
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity deleteDocument(Long id)
    {
        documentService.delete(id);
        return ResponseEntity.ok().build();
    }

    public ResponseEntity getVersions(Long documentId)
    {
        return ResponseEntity.ok(documentVersionService.getVersions(documentId));
    }

    public ResponseEntity getVersion(Long documentId, String versionNumber)
    {
        DocumentVersionDto version = documentVersionService.getVersion(documentId, versionNumber);
        if(version == null)
            return ResponseEntity.notFound().build();
        else
            return ResponseEntity.ok(version);
    }

    public ResponseEntity saveVersion(Long documentId, DocumentVersionDto dto)
    {
        DocumentVersionDto saved = documentVersionService.saveVersion(documentId, dto);
        return ResponseEntity.ok(saved);
    }

    public ResponseEntity deleteVersion(Long versionId)
    {
        documentVersionService.deleteVersion(versionId);
        return ResponseEntity.ok().build();
    }

    public DocumentController(DocumentService documentService, DocumentVersionService documentVersionService)
    {
        this.documentService = documentService;
        this.documentVersionService = documentVersionService;
    }

    private final DocumentService documentService;
    private final DocumentVersionService documentVersionService;
}
