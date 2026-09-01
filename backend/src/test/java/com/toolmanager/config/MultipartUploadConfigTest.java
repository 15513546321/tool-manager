package com.toolmanager.config;

import org.junit.jupiter.api.Test;

import javax.servlet.MultipartConfigElement;

import static org.assertj.core.api.Assertions.assertThat;

class MultipartUploadConfigTest {

    @Test
    void configuresTwoHundredMegabyteUploadsInCode() {
        MultipartConfigElement element = new MultipartUploadConfig().multipartConfigElement();

        assertThat(element.getMaxFileSize()).isEqualTo(MultipartUploadConfig.MAX_FILE_SIZE_BYTES);
        assertThat(element.getMaxRequestSize()).isEqualTo(MultipartUploadConfig.MAX_REQUEST_SIZE_BYTES);
        assertThat(element.getFileSizeThreshold()).isEqualTo(2 * 1024 * 1024);
    }
}
