package com.toolmanager.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "DB_CONNECTIONS")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DbConnection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type; // ORACLE_SOURCE, ORACLE_TARGET, etc.

    @Column(length = 500)
    private String host;

    @Column
    private Integer port;

    @Column
    private String database;

    @Column
    private String username;

    @Column(length = 2000)
    private String password;

    @Column(length = 5000)
    private String connectionString;

    @Column(length = 5000)
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;
}
