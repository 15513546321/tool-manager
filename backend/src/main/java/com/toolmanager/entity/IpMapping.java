package com.toolmanager.entity;

import javax.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ip_mappings", uniqueConstraints = @UniqueConstraint(columnNames = "ip"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IpMapping {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ip", nullable = false, unique = true)
    private String ip;

    @Column(name = "name", nullable = false)
    private String name;
}
